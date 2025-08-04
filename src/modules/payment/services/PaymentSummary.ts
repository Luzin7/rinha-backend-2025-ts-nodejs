import Redis from 'ioredis';
import { Service } from '../../../core/contracts/Service';
import { Either, left, right } from '../../../core/errors/Either';
import { GetSummaryParams } from '../dtos/GetSummaryParams';
import { Summary } from '../dtos/Summary';
import { QueueError, SummaryError } from '../payment.errors';

type Error = QueueError;

export class PaymentSummaryService
  implements Service<GetSummaryParams, Error, Summary>
{
  constructor(private cache: Redis) {}

  execute = async ({
    from,
    to,
  }: GetSummaryParams): Promise<Either<Error, Summary>> => {
    try {
      const fromTs = from ? new Date(from).getTime() : '-inf';
      const toTs = to ? new Date(to).getTime() : '+inf';

      const payments = await this.cache.zrangebyscore('payments', fromTs, toTs);

      const summary: Summary = {
        default: { totalAmount: 0, totalRequests: 0 },
        fallback: { totalAmount: 0, totalRequests: 0 },
      };

      for (const payment of payments) {
        const data = JSON.parse(payment);
        if (data.p === 'default') {
          summary.default.totalAmount += data.a;
          summary.default.totalRequests++;
        } else if (data.p === 'fallback') {
          summary.fallback.totalAmount += data.a;
          summary.fallback.totalRequests++;
        }
      }

      summary.default.totalAmount = this.safeDollar(
        summary.default.totalAmount,
      );
      summary.fallback.totalAmount = this.safeDollar(
        summary.fallback.totalAmount,
      );

      console.log(
        `[SERVICE] Resumo de pagamentos entre ${fromTs} e ${toTs}:`,
        JSON.stringify(summary, null, 2),
      );

      return right(summary);
    } catch (error) {
      console.error('[SERVICE_ERROR] Falha ao buscar sumário do Redis:', error);
      return left(new SummaryError());
    }
  };

  private safeDollar(input: number, scaleFactor: bigint = 100n): number {
    const fixed = BigInt(Math.round(input * Number(scaleFactor)));
    return Number(fixed) / (100 * Number(scaleFactor));
  }
}
