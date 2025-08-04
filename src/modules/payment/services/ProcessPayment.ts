import { Agent, request } from 'undici';
import { Service } from '../../../core/contracts/Service';
import { Either, left, right } from '../../../core/errors/Either';
import { ServiceError } from '../../../core/errors/ServiceError';
import { QueuePayment } from '../dtos/QueuePayment';
import { PaymentRepository } from '../repositories/PaymentRepository';

const keepAliveAgent = new Agent({
  connections: 250,
  keepAliveTimeout: 60 * 1000,
});

type PaymentProcessorResponse = {
  processor: 'default' | 'fallback';
};

type ProcessorState = {
  failureCount: number;
  lastFailureTime: number;
  isCircuitOpen: boolean;
};

type ProcessorConfig = {
  url: string;
  timeout: number;
  maxFailures: number;
  circuitBreakerTimeout: number;
};

export class ProcessPaymentService
  implements Service<QueuePayment, ServiceError, PaymentProcessorResponse>
{
  private readonly defaultConfig: ProcessorConfig;
  private readonly fallbackConfig: ProcessorConfig;
  private readonly defaultState: ProcessorState;
  private readonly fallbackState: ProcessorState;

  constructor(
    private paymentRepository: PaymentRepository,
    paymentProcessorUrlDefault: string,
    paymentProcessorUrlFallback: string,
  ) {
    this.defaultConfig = {
      url: paymentProcessorUrlDefault,
      timeout: 1500,
      maxFailures: 2,
      circuitBreakerTimeout: 2500,
    };

    this.fallbackConfig = {
      url: paymentProcessorUrlFallback,
      timeout: 1800,
      maxFailures: 2,
      circuitBreakerTimeout: 2500,
    };

    this.defaultState = {
      failureCount: 0,
      lastFailureTime: 0,
      isCircuitOpen: false,
    };

    this.fallbackState = {
      failureCount: 0,
      lastFailureTime: 0,
      isCircuitOpen: false,
    };
  }

  execute = async ({
    amount,
    correlationId,
  }: QueuePayment): Promise<Either<ServiceError, PaymentProcessorResponse>> => {
    const defaultResult = await this.tryProcessor(
      'default',
      this.defaultConfig,
      this.defaultState,
      { amount, correlationId },
    );

    if (defaultResult.success) {
      this.onProcessorSuccess(this.defaultState);
      return right({ processor: 'default' });
    }

    const fallbackResult = await this.tryProcessor(
      'fallback',
      this.fallbackConfig,
      this.fallbackState,
      { amount, correlationId },
    );

    if (fallbackResult.success) {
      this.onProcessorSuccess(this.fallbackState);
      return right({ processor: 'fallback' });
    }

    console.error(`[WORKER] Falhou geral ${correlationId}`);
    return left(new ServiceError('All payment processors failed', 503));
  };

  private async tryProcessor(
    processorName: 'default' | 'fallback',
    config: ProcessorConfig,
    state: ProcessorState,
    payload: QueuePayment,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isCircuitBreakerOpen(state, config)) {
      return { success: false, error: 'Circuit breaker open' };
    }

    try {
      const success = await this.processPayment(config, payload, processorName);

      if (success) {
        return { success: true };
      } else {
        this.onProcessorFailure(state);
        return { success: false, error: 'Payment processing failed' };
      }
    } catch (error) {
      this.onProcessorFailure(state);
      const errorMessage = (error as Error).message;
      console.warn(
        `[WORKER] ${processorName} falhou para ${payload.correlationId}: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  private isCircuitBreakerOpen(
    state: ProcessorState,
    config: ProcessorConfig,
  ): boolean {
    if (!state.isCircuitOpen) return false;

    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    if (timeSinceLastFailure > config.circuitBreakerTimeout) {
      state.isCircuitOpen = false;
      state.failureCount = 0;
      console.info('[WORKER] Circuit breaker fechado - tentando novamente');
      return false;
    }

    return true;
  }

  private onProcessorSuccess(state: ProcessorState): void {
    state.failureCount = 0;
    state.isCircuitOpen = false;
  }

  private onProcessorFailure(state: ProcessorState): void {
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.failureCount >= 8) {
      state.isCircuitOpen = true;
      console.warn('[WORKER] Circuit breaker aberto devido a muitas falhas');
    }
  }

  private async processPayment(
    config: ProcessorConfig,
    { amount, correlationId }: QueuePayment,
    processorName: 'default' | 'fallback',
  ): Promise<boolean> {
    const requestedAt = new Date();
    const payload = { correlationId, amount, requestedAt };

    const { statusCode } = await request(`${config.url}/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      bodyTimeout: config.timeout,
      headersTimeout: config.timeout,
      dispatcher: keepAliveAgent,
    });

    if (statusCode >= 200 && statusCode < 300) {
      await this.savePaymentWithRetry(
        correlationId,
        amount,
        processorName,
        requestedAt.getTime(),
      );
      return true;
    }

    return false;
  }

  private async savePaymentWithRetry(
    correlationId: string,
    amount: number,
    processorName: 'default' | 'fallback',
    timestamp: number,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.paymentRepository.insertPaymentSummary(
          correlationId,
          amount,
          processorName,
          timestamp,
        );
        return;
      } catch (error) {
        console.error(
          `[REDIS_RETRY] Tentativa ${attempt}/${maxRetries} falhou para ${correlationId}:`,
          error,
        );

        if (attempt === maxRetries) {
          console.error(
            `[CRITICAL_FAILURE] Todas as ${maxRetries} tentativas falharam para ${correlationId}`,
          );
          throw error;
        }

        const delay = 50 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  resetFailureCounts(): void {
    this.defaultState.failureCount = 0;
    this.defaultState.isCircuitOpen = false;
    this.fallbackState.failureCount = 0;
    this.fallbackState.isCircuitOpen = false;
    console.info('[WORKER] Contadores de falha resetados');
  }

  getProcessorStats() {
    return {
      default: {
        failureCount: this.defaultState.failureCount,
        isCircuitOpen: this.defaultState.isCircuitOpen,
      },
      fallback: {
        failureCount: this.fallbackState.failureCount,
        isCircuitOpen: this.fallbackState.isCircuitOpen,
      },
    };
  }
}
