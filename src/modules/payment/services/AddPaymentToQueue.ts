import { Queue } from 'bullmq';
import { Service } from '../../../core/contracts/Service';
import { Either, right } from '../../../core/errors/Either';
import { QueuePayment } from '../dtos/QueuePayment';

export class AddPaymentToQueueService
  implements Service<QueuePayment, never, null>
{
  constructor(private queue: Queue) {}

  execute = async ({
    amount,
    correlationId,
  }: QueuePayment): Promise<Either<never, null>> => {
    await this.queue.add(
      'process-payment',
      { amount, correlationId },
      {
        jobId: correlationId,
        removeOnComplete: true,
        removeOnFail: 5000,
        attempts: 5,
        backoff: {
          type: 'fixed',
          delay: 500,
        },
      },
    );

    return right(null);
  };
}
