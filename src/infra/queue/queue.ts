import { Queue } from 'bullmq';
import { redis } from '../cache/redis';

export const paymentQueue = new Queue('payment_queue', { connection: redis });
