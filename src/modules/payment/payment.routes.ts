import { FastifyInstance } from 'fastify';
import { redis } from '../../infra/cache/redis';
import { PaymentController } from './payment.controllers';
import { PaymentService } from './payment.service';

export async function paymentRoutes(app: FastifyInstance) {
  const paymentsService = new PaymentService(redis);
  const paymentController = new PaymentController(paymentsService);

  app.post('/payments', paymentController.create);
  app.get('/payments-summary', paymentController.getSummary);
  app.post('/purge-payments', paymentController.purge);
}
