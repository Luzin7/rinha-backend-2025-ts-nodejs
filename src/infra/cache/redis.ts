import { Redis } from 'ioredis';
import { env } from '../../env';

export const redis = new Redis({
  host: env.CACHE_HOST,
  port: env.CACHE_PORT,
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('[REDIS] Conectado com sucesso!');
});

redis.on('error', (error) => {
  console.error('[REDIS] Erro de conexão:', error);
});
