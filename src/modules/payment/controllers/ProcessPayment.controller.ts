import { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { Controller } from '../../../shared/contracts/Controller';
import { paymentBodySchema } from '../schemas/paymentBody.schema';
import { ProcessPaymentService } from '../services/ProcessPayment.service';

export class ProcessPaymentController implements Controller {
  constructor(private paymentService: ProcessPaymentService) {}

  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const validation = paymentBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        message: 'Invalid payload',
        issues: z.treeifyError(validation.error),
      });
    }

    const { correlationId, amount } = validation.data;

    const response = await this.paymentService.execute({
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
  }
}
