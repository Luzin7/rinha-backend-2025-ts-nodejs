import z from 'zod';

export const summaryQuerySchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
});
