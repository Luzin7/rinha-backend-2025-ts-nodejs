import { request } from 'undici';
import {
  REDIS_STATUS_KEY,
  REDIS_WATCHER_LOCK_KEY,
} from './constants/redis-keys';
import { env } from './env';
import { redis } from './infra/cache/redis';

const HEALTH_CHECK_URLS = {
  default: `${env.PAYMENT_PROCESSOR_URL_DEFAULT}/payments/service-health`,
  fallback: `${env.PAYMENT_PROCESSOR_URL_FALLBACK}/payments/service-health`,
};

async function checkProcessorHealth(processorName: 'default' | 'fallback') {
  const url = HEALTH_CHECK_URLS[processorName];
  const redisKey = REDIS_STATUS_KEY[processorName];

  try {
    const { body, statusCode } = await request(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      bodyTimeout: 2000,
    });

    if (statusCode !== 200) {
      throw new Error(
        `Health check for ${processorName} failed with status ${statusCode}`,
      );
    }

    const data: { failing: boolean } = (await body.json()) as {
      failing: boolean;
    };

    if (data.failing === false) {
      await redis.set(redisKey, 'UP', 'EX', 10);
    } else {
      await redis.set(redisKey, 'DOWN', 'EX', 10);
      console.error(`[WATCHER] payment processor "${processorName}" is DOWN`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    await redis.set(redisKey, 'DOWN', 'EX', 10);
    console.error(
      `[WATCHER] payment processor "${processorName}" id DOWN (req error)`,
    );
  }
}

async function runWatcherCycle() {
  const lockAcquired = await redis.set(
    REDIS_WATCHER_LOCK_KEY,
    'running',
    'EX',
    5,
    'NX',
  );

  if (!lockAcquired) {
    return;
  }

  try {
    await Promise.all([
      checkProcessorHealth('default'),
      checkProcessorHealth('fallback'),
    ]);
  } catch (error) {
    console.error('[WATCHER] Error checking health status.', error);
  }
}

function startWatcher() {
  console.log(`[WATCHER] service started`);

  runWatcherCycle();

  setInterval(runWatcherCycle, 5000);
}

startWatcher();
