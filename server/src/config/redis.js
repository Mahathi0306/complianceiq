import IORedis from 'ioredis';
import { env } from './env.js';

let client;

export function getRedis() {
  if (!client) {
    client = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  }
  return client;
}
