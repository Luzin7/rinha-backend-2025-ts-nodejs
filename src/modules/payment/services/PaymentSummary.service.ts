import { Pool } from 'pg';
import { Either, left, right } from '../../../core/errors/Either';
import { Service } from '../../../shared/contracts/Service';
import { GetSummaryParams } from '../dtos/GetSummaryParams.dto';
import { Summary } from '../dtos/Summary.dto';
import {
  DatabaseError,
  QueueError,
  UnexpectedResultError,
} from '../payment.errors';

type Error = DatabaseError | UnexpectedResultError;

export class PaymentSummaryService
  implements Service<GetSummaryParams, Error, Summary>
{
  constructor(private db: Pool) {}

  execute = async ({
    from,
    to,
  }: GetSummaryParams): Promise<Either<QueueError, Summary>> => {
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
      dbResult = await this.db.query(queryText, queryParams);
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
  };
}
