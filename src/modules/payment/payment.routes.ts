import { FastifyInstance } from 'fastify';
import { redis } from '../../infra/cache/redis';
import { PaymentSummaryController } from './controllers/PaymentSummary.controller';
import { ProcessPaymentController } from './controllers/ProcessPayment.controller';
import { PurgePaymentsController } from './controllers/PurgePayments.controller';
import { PaymentSummaryService } from './services/PaymentSummary.service';
import { ProcessPaymentService } from './services/ProcessPayment.service';
import { PurgePaymentsService } from './services/PurgePayments.service';

export async function paymentRoutes(app: FastifyInstance) {
  const processPaymentService = new ProcessPaymentService(redis);
  const processPaymentController = new ProcessPaymentController(
    processPaymentService,
  );
  const paymentSummaryService = new PaymentSummaryService(redis);
  const paymentSummaryController = new PaymentSummaryController(
    paymentSummaryService,
  );
  const purgePaymentsService = new PurgePaymentsService(redis);
  const purgePaymentsController = new PurgePaymentsController(
    purgePaymentsService,
  );

  app.post('/payments', processPaymentController.handle);
  app.get('/payments-summary', paymentSummaryController.handle);
  app.post('/purge-payments', purgePaymentsController.handle);
}
