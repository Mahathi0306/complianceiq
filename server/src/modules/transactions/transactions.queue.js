import { Queue } from 'bullmq';
import { getRedis } from '../../config/redis.js';

export const TRANSACTION_QUEUE = 'transactions';

let queue;

export function getTransactionQueue() {
  if (!queue) {
    queue = new Queue(TRANSACTION_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 2000,
        removeOnFail: 5000,
      },
    });
  }
  return queue;
}
