import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { ProcessPaymentService } from './modules/payment/services/ProcessPayment';

export class PaymentWorker {
  private readonly CONCURRENCY: number;
  private worker?: Worker;

  constructor(
    private processPayment: ProcessPaymentService,
    private redis: Redis,
    private concurrency: number,
  ) {
    this.CONCURRENCY = this.concurrency;
  }

  execute() {
    console.log('[WORKER] Iniciando...');

    this.worker = new Worker(
      'payment_queue',
      async (job) => {
        const { correlationId, amount } = job.data;

        return await this.processPayment.execute({
          correlationId,
          amount,
        });
      },
      {
        connection: this.redis,
        concurrency: this.CONCURRENCY,
      },
    );

    this.worker.on('failed', (job, err) => {
      console.error(
        `[WORKER] Job ${job?.id} falhou após todas as tentativas:`,
        err,
      );
    });
  }
}
