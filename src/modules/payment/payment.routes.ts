import { FastifyInstance } from 'fastify';
import { redis } from '../../infra/cache/redis';
import { paymentQueue } from '../../infra/queue/queue';
import { AddPaymentToQueueController } from './controllers/AddPaymentToQueue';
import { PaymentSummaryController } from './controllers/PaymentSummary';
import { PurgePaymentsController } from './controllers/PurgePayments';
import { AddPaymentToQueueService } from './services/AddPaymentToQueue';
import { PaymentSummaryService } from './services/PaymentSummary';
import { PurgePaymentsService } from './services/PurgePayments';

export async function paymentRoutes(app: FastifyInstance) {
  const addPaymentToQueueService = new AddPaymentToQueueService(paymentQueue);
  const addPaymentToQueueController = new AddPaymentToQueueController(
    addPaymentToQueueService,
  );
  const paymentSummaryService = new PaymentSummaryService(redis);
  const paymentSummaryController = new PaymentSummaryController(
    paymentSummaryService,
  );
  const purgePaymentsService = new PurgePaymentsService(redis);
  const purgePaymentsController = new PurgePaymentsController(
    purgePaymentsService,
  );

  app.post('/payments', addPaymentToQueueController.handle);
  app.get('/payments-summary', paymentSummaryController.handle);
  app.post('/purge-payments', purgePaymentsController.handle);
}
