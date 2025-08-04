import Redis from 'ioredis';
import { PaymentRepository } from '../../../modules/payment/repositories/PaymentRepository';

export class PaymentRepositoryImpl implements PaymentRepository {
  constructor(private database: Redis) {}
  async insertPaymentSummary(
    correlationId: string,
    amount: number,
    processor: 'default' | 'fallback',
    timestamp: number,
  ) {
    const data = JSON.stringify({
      p: processor,
      a: amount,
      id: correlationId,
    });

    const pipeline = this.database.pipeline();
    pipeline.zadd('payments', 'NX', timestamp, data);
    const results = await pipeline.exec();

    if (!results || results.length === 0) {
      throw new Error('Pipeline Redis falhou');
    }

    const [error, result] = results[0];
    if (error) {
      throw error;
    }

    if (result === 0) {
      console.warn(
        `[REDIS] Pagamento ${correlationId} já existe (duplicata ignorada)`,
      );
    }
  }
}
