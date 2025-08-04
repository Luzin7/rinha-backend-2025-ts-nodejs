import { env } from './env';
import { redis } from './infra/cache/redis';
import { PaymentRepositoryImpl } from './infra/database/payment/PaymentRepositoryImpl';
import { ProcessPaymentService } from './modules/payment/services/ProcessPayment';
import { PaymentWorker } from './worker';

const paymentProcessorUrlDefault = env.PAYMENT_PROCESSOR_URL_DEFAULT!;
const paymentProcessorUrlFallback = env.PAYMENT_PROCESSOR_URL_FALLBACK!;

class Bootstrap {
  constructor(private paymentWorker: PaymentWorker) {}

  async execute() {
    this.paymentWorker.execute();
    // startWatcher();
  }
}

const bootstrap = new Bootstrap(
  new PaymentWorker(
    new ProcessPaymentService(
      new PaymentRepositoryImpl(redis),
      paymentProcessorUrlDefault,
      paymentProcessorUrlFallback,
    ),
    redis,
    180,
  ),
);

bootstrap.execute().catch((err) => {
  console.error('[MAIN] Falha na inicialização.', err);
  process.exit(1);
});
