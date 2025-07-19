import { z } from 'zod';

const envSchema = z.object({
  APP_PORT: z.coerce.number().default(9999),

  DB_USER: z.string().default('rinha'),
  DB_PASSWORD: z.string().default('rinha'),
  DB_NAME: z.string().default('rinha'),

  CACHE_HOST: z.string().default('cache'),
  CACHE_PORT: z.coerce.number().default(6379),

  PAYMENT_PROCESSOR_URL_DEFAULT: z
    .url()
    .default('http://payment-processor-default:8080'),
  PAYMENT_PROCESSOR_URL_FALLBACK: z
    .url()
    .default('http://payment-processor-fallback:8080'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('Invalid environment variables:', z.treeifyError(_env.error));
  throw new Error('Invalid environment variables.');
}

export const env = _env.data;
