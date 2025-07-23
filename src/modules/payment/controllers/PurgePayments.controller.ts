import { FastifyReply, FastifyRequest } from 'fastify';
import { Controller } from '../../../shared/contracts/Controller';
import { PurgePaymentsService } from '../services/PurgePayments.service';

export class PurgePaymentsController implements Controller {
  constructor(private paymentService: PurgePaymentsService) {}

  handle = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await this.paymentService.execute();

    if (result.isLeft()) {
      const error = result.value;
      return reply.status(error.statusCode).send({ error: error.message });
    }

    return reply.status(204).send();
  };
}
