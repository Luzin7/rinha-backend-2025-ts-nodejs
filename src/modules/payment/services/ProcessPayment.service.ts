import Redis from 'ioredis';
import { Either, left, right } from '../../../core/errors/Either';
import { Service } from '../../../shared/contracts/Service';
import { QueuePayment } from '../dtos/QueuePayment.dto';
import { QueueError } from '../payment.errors';

type Error = QueueError;

export class ProcessPaymentService
  implements Service<QueuePayment, Error, null>
{
  constructor(private cache: Redis) {}

  async execute({
    amount,
    correlationId,
  }: QueuePayment): Promise<Either<Error, null>> {
    const jobPayload = JSON.stringify({ correlationId, amount });

    const jobIsQueued = await this.cache
      .lpush('payment_queue', jobPayload)
      .catch(() => {
        return false;
      });

    if (!jobIsQueued) {
      return left(new QueueError());
    }

    return right(null);
  }
}
