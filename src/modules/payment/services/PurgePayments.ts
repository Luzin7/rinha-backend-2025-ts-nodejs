import Redis from 'ioredis';
import { Service } from '../../../core/contracts/Service';
import { Either, left, right } from '../../../core/errors/Either';
import { GetSummaryParams } from '../dtos/GetSummaryParams';
import { DatabaseError } from '../payment.errors';

type Error = DatabaseError;

export class PurgePaymentsService
  implements Service<GetSummaryParams, Error, null>
{
  constructor(private db: Redis) {}

  execute = async (): Promise<Either<Error, null>> => {
    try {
      await this.db.flushall();

      return right(null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return left(new DatabaseError('Failed to purge database'));
    }
  };
}
