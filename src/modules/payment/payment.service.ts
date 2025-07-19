import Redis from 'ioredis';
import { REDIS_STATUS_KEY } from '../../constants/redis-keys';
import { Either, left, right } from '../../core/errors/Either';
import { ServiceError } from '../../core/errors/ServiceError';
import { pool } from '../../infra/database/pg-connection';
import {
  DatabaseError,
  QueueError,
  UnexpectedResultError,
} from './payment.errors';

interface QueuePayment {
  correlationId: string;
  amount: number;
}

type GetSummaryParams = {
  from?: string;
  to?: string;
};

interface Summary {
  default: {
    totalRequests: number;
    totalAmount: number;
  };
  fallback: {
    totalRequests: number;
    totalAmount: number;
  };
}

export class PaymentService {
  constructor(private cache: Redis) {}

  async queuePayment({
    correlationId,
    amount,
  }: QueuePayment): Promise<Either<ServiceError, null>> {
    const jobPayload = JSON.stringify({ correlationId, amount });

    const jobIsQueued = await this.cache.lpush('payment_queue', jobPayload);

    if (!jobIsQueued) {
      return left(new QueueError());
    }

    return right(null);
  }

  async getSummary({
    from,
    to,
  }: GetSummaryParams): Promise<Either<ServiceError, Summary>> {
    let dbResult;
    let queryText = `
        SELECT 
          processor,
          COUNT(*)::int AS total_requests,
          SUM(amount) AS total_amount
        FROM 
          payments
      `;
    const queryParams = [];
    const whereClauses = [];

    let paramIndex = 1;

    if (from) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      queryParams.push(from);
    }
    if (to) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      queryParams.push(to);
    }

    if (whereClauses.length > 0) {
      queryText += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    queryText += ' GROUP BY processor;';

    try {
      dbResult = await pool.query(queryText, queryParams);
    } catch (error) {
      console.error('[SERVICE_ERROR] Summay query error:', error);
      return left(new DatabaseError());
    }

    if (!dbResult || !dbResult.rows) {
      return left(new UnexpectedResultError());
    }

    const summary: Summary = {
      default: { totalRequests: 0, totalAmount: 0 },
      fallback: { totalRequests: 0, totalAmount: 0 },
    };

    for (const row of dbResult.rows) {
      if (row.processor === 'default') {
        summary.default.totalRequests = row.total_requests;
        summary.default.totalAmount = parseFloat(row.total_amount || 0);
      } else if (row.processor === 'fallback') {
        summary.fallback.totalRequests = row.total_requests;
        summary.fallback.totalAmount = parseFloat(row.total_amount || 0);
      }
    }

    return right(summary);
  }

  async purgeAll(): Promise<Either<ServiceError, null>> {
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
      return left(new DatabaseError('Failed to purge data'));
    }
  }
}
