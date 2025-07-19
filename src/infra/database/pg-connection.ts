import { Pool } from 'pg';
import { env } from '../../env';

export const pool = new Pool({
  host: 'db',
  port: 5432,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,

  max: 80,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('[POSTGRES] Pool de conexões iniciado com sucesso.');
});

pool.on('error', (err) => {
  console.error('[POSTGRES] Erro inesperado no pool de conexões.', err);
  process.exit(-1);
});

const gracefulShutdown = () => {
  pool.end().then(() => {
    console.log('[POSTGRES] Pool de conexões encerrado.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
