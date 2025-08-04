import z from 'zod';

export const paymentBodySchema = z.object({
  correlationId: z.uuid(),
  amount: z.number().positive(),
});
