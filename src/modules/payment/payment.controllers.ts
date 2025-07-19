import { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { paymentBodySchema, summaryQuerySchema } from './payment.schemas';
import { PaymentService } from './payment.service';

export class PaymentController {
  constructor(private paymentsService: PaymentService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = paymentBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        message: 'Invalid payload',
        issues: validation.error.format(),
      });
    }

    const { correlationId, amount } = validation.data;

    const response = await this.paymentsService.queuePayment({
      correlationId,
      amount,
    });

    if (response.isLeft()) {
      const error = response.value;
      return reply.status(error.statusCode).send({ message: error.message });
    }

    return reply
      .status(202)
      .send({ message: 'payment processed successfully' });
  };

  getSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const validation = summaryQuerySchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        issues: z.treeifyError(validation.error),
      });
    }

    const { from, to } = validation.data;

    const response = await this.paymentsService.getSummary({
      from,
      to,
    });

    if (response.isLeft()) {
      const error = response.value;
      return reply.status(error.statusCode).send({ message: error.message });
    }

    const summary = response.value;

    reply.send(summary);
  };

  purge = async (_: FastifyRequest, reply: FastifyReply) => {
    const result = await this.paymentsService.purgeAll();

    if (result.isLeft()) {
      const error = result.value;
      return reply.status(error.statusCode).send({ error: error.message });
    }

    return reply.status(204).send();
  };
}
