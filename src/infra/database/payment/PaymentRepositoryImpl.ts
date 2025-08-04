import Redis from 'ioredis';
import { PaymentRepository } from '../../../modules/payment/repositories/PaymentRepository';

export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private database: Redis) {}
  async insertPaymentSummary(
    correlationId: string,
    amount: number,
    processor: 'default' | 'fallback',
  ) {
    const timestamp = Date.now();
    const data = JSON.stringify({
      p: processor,
      a: amount * 100,
      id: correlationId,
    });
    await this.database.zadd('payments', 'NX', timestamp, data);
  }
}
