import Redis from 'ioredis';
import { REDIS_STATUS_KEY } from '../../../constants/redis-keys';
import { Either, left, right } from '../../../core/errors/Either';
import { pool } from '../../../infra/database/pg-connection';
import { Service } from '../../../shared/contracts/Service';
import { GetSummaryParams } from '../dtos/GetSummaryParams.dto';
import { DatabaseError, QueueError } from '../payment.errors';

type Error = DatabaseError;

export class PurgePaymentsService
  implements Service<GetSummaryParams, Error, null>
{
  constructor(private cache: Redis) {}

  async execute(): Promise<Either<QueueError, null>> {
    try {
      await Promise.all([
        pool.query('TRUNCATE TABLE payments RESTART IDENTITY;'),

        this.cache.del('payment_queue'),

        this.cache.del(REDIS_STATUS_KEY.default),
        this.cache.del(REDIS_STATUS_KEY.fallback),
      ]);

      return right(null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return left(new DatabaseError(`Failed to purge data`));
    }
  }
}
