import z from 'zod';

export const paymentBodySchema = z.object({
  correlationId: z.uuid(),
  amount: z.number().positive(),
});

export const summaryQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
