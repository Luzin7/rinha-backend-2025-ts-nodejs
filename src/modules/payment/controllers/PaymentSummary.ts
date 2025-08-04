import { FastifyReply, FastifyRequest } from 'fastify';
import z from 'zod';
import { Controller } from '../../../core/contracts/Controller';
import { summaryQuerySchema } from '../schemas/summaryQueue';
import { PaymentSummaryService } from '../services/PaymentSummary';

export class PaymentSummaryController implements Controller {
  constructor(private paymentService: PaymentSummaryService) {}

  handle = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const validation = summaryQuerySchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        issues: z.treeifyError(validation.error),
      });
    }

    const { from, to } = validation.data;

    const response = await this.paymentService.execute({
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
}
