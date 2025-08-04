import { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { Controller } from '../../../core/contracts/Controller';
import { paymentBodySchema } from '../schemas/paymentBody';
import { AddPaymentToQueueService } from '../services/AddPaymentToQueue';

export class AddPaymentToQueueController implements Controller {
  constructor(private paymentService: AddPaymentToQueueService) {}

  handle = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const validation = paymentBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        message: 'Invalid payload',
        issues: z.treeifyError(validation.error),
      });
    }

    const { correlationId, amount } = validation.data;

    await this.paymentService.execute({
      correlationId,
      amount,
    });

    return reply.status(202).send({ message: 'payment queued successfully' });
  };
}
