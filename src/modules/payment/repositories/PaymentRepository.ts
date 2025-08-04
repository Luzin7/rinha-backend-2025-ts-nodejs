export interface PaymentRepository {
  insertPaymentSummary(
    correlationId: string,
    amount: number,
    processor: 'default' | 'fallback',
  ): Promise<void>;
}
