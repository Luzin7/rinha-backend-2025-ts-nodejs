import cors from '@fastify/cors';
import fastify from 'fastify';
import { env } from './env';
import { paymentRoutes } from './modules/payment/payment.routes';

const app = fastify({
  logger: false,
});
app.register(cors, {
  origin: ['*'], // CALMA MAINHA ISSO EH TEMPORARIO
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
app.register(paymentRoutes);

const port = env.APP_PORT;
app.listen({ port, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`server listening on ${address}`);
});
