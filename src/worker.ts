import { request } from 'undici';
import { REDIS_STATUS_KEY } from './constants/redis-keys';
import { env } from './env';
import { redis } from './infra/cache/redis';
import { pool } from './infra/database/pg-connection';

const { PAYMENT_PROCESSOR_URL_DEFAULT, PAYMENT_PROCESSOR_URL_FALLBACK } = env;
const { default: defaultKey, fallback } = REDIS_STATUS_KEY;

async function insertPayment(
  correlationId: string,
  amount: number,
  processor: 'default' | 'fallback',
) {
  await pool.query(
    'INSERT INTO payments(correlation_id, amount, processor) VALUES($1, $2, $3)',
    [correlationId, amount, processor],
  );
}

async function processPayment(job: { correlationId: string; amount: number }) {
  const { correlationId, amount } = job;
  const payload = { correlationId, amount, requestedAt: new Date() };

  const [defaultStatus, fallbackStatus] = await redis.mget(
    defaultKey,
    fallback,
  );

  if (defaultStatus === 'UP') {
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

      if (statusCode !== 200) {
        throw new Error(
          `Default processor responded with status ${statusCode}`,
        );
      }

      await insertPayment(correlationId, amount, 'default');
      return;
    } catch (error) {
      console.warn(
        `[WORKER] DEFAULT failed even UP, trying FALLBACK to ${correlationId}: ${error}`,
      );
    }
  }

  if (fallbackStatus === 'UP') {
    try {
      const { statusCode } = await request(
        `${PAYMENT_PROCESSOR_URL_FALLBACK}/payments`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (statusCode !== 200) {
        throw new Error(
          `Fallback processor responded with status ${statusCode}`,
        );
      }

      await insertPayment(correlationId, amount, 'fallback');
    } catch (error) {
      console.error(`[WORKER] TOTAL FAILED to ${correlationId}`, error);
    }
  } else {
    console.error(
      `[WORKER] TOTAL FAILED! Both processor are DOWN or failed to ${correlationId}`,
    );
  }
}

async function runWorker() {
  const MAX_JOBS = 30;
  const activeJobs: Promise<unknown>[] = [];
  while (true) {
    try {
      const result = await redis.brpop('payment_queue', 0);
      if (result) {
        const jobData = JSON.parse(result[1]);
        const jobPromise = processPayment(jobData)
          .catch((err) => {
            console.error(
              `[WORKER] Job ${jobData.correlationId} falhou com erro não tratado:`,
              err,
            );
          })
          .finally(() => {
            activeJobs.splice(activeJobs.indexOf(jobPromise), 1);
          });
        activeJobs.push(jobPromise);

        if (activeJobs.length >= MAX_JOBS) {
          await Promise.race(activeJobs);
        }
      }
    } catch (error) {
      console.error('[WORKER] Main loop error:', error);
      await new Promise((_resolve) => setTimeout(_resolve, 5000));
    }
  }
}

runWorker();
