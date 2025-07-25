import { request } from 'undici';
import { env } from './env';
import { redis } from './infra/cache/redis';
import { pool } from './infra/database/pg-connection';

const PAYMENT_QUEUE = 'payment_queue';
const PROCESSING_QUEUE = 'processing_queue';

const PAYMENT_PROCESSOR_URL_DEFAULT = env.PAYMENT_PROCESSOR_URL_DEFAULT!;
const PAYMENT_PROCESSOR_URL_FALLBACK = env.PAYMENT_PROCESSOR_URL_FALLBACK!;

async function insertPayment(
  correlationId: string,
  amount: number,
  processor: 'default' | 'fallback',
) {
  await pool.query(
    `INSERT INTO payments(correlation_id, amount, processor)
     VALUES ($1, $2, $3)
     ON CONFLICT (correlation_id) DO NOTHING`,
    [correlationId, amount, processor],
  );
}

async function processSinglePayment(job: {
  correlationId: string;
  amount: number;
}) {
  const payload = {
    correlationId: job.correlationId,
    amount: job.amount,
    requestedAt: new Date(),
  };

  try {
    const { statusCode } = await request(
      `${PAYMENT_PROCESSOR_URL_DEFAULT}/payments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        bodyTimeout: 3000,
      },
    );
    if (statusCode !== 200)
      throw new Error(`Default processor returned status ${statusCode}`);
    await insertPayment(job.correlationId, job.amount, 'default');
    return;
  } catch (err) {
    console.warn(
      `[WORKER] Default processor failed for ${job.correlationId}, trying fallback:`,
      err,
    );
  }

  try {
    const { statusCode } = await request(
      `${PAYMENT_PROCESSOR_URL_FALLBACK}/payments`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (statusCode !== 200)
      throw new Error(`Fallback processor returned status ${statusCode}`);
    await insertPayment(job.correlationId, job.amount, 'fallback');
  } catch (err) {
    console.error(
      `[WORKER] Both processors failed for ${job.correlationId}`,
      err,
    );
    throw err;
  }
}

async function removeFromProcessingQueue(jobStr: string) {
  await redis.lrem(PROCESSING_QUEUE, 1, jobStr);
}

async function requeueJob(jobStr: string) {
  await redis.lpush(PAYMENT_QUEUE, jobStr);
  await redis.lrem(PROCESSING_QUEUE, 1, jobStr);
}

async function runWorker() {
  while (true) {
    try {
      const jobStr = await redis.brpoplpush(PAYMENT_QUEUE, PROCESSING_QUEUE, 0);
      if (!jobStr) continue;
      const job = JSON.parse(jobStr);

      try {
        await processSinglePayment(job);
        await removeFromProcessingQueue(jobStr);
      } catch (err) {
        console.error(`[WORKER] Falha ao processar ${job.correlationId}:`, err);
      }
    } catch (err) {
      console.error('[WORKER] Erro no loop principal:', err);
      await new Promise((_resolve) => setTimeout(_resolve, 5000));
    }
  }
}

async function requeueStuckJobs() {
  try {
    const stuckJobs = await redis.lrange(PROCESSING_QUEUE, 0, -1);
    for (const jobStr of stuckJobs) {
      await requeueJob(jobStr);
    }
  } catch (err) {
    console.error('[WORKER] Erro no requeueStuckJobs:', err);
  }
}

runWorker();
setInterval(requeueStuckJobs, 60000);
