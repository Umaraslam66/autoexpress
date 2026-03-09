import { Redis } from 'ioredis';
import { createClient } from 'redis';
import { env, hasRedisConfig } from '../config/env.js';

type BullRedisClient = InstanceType<typeof Redis>;

let bullRedis: BullRedisClient | null = null;
let sessionRedisPromise: ReturnType<typeof createClient> | null = null;

export function getBullRedis(): BullRedisClient | null {
  if (!hasRedisConfig()) {
    return null;
  }

  if (!bullRedis) {
    bullRedis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return bullRedis;
}

export async function getSessionRedisClient() {
  if (!hasRedisConfig()) {
    return null;
  }

  if (!sessionRedisPromise) {
    const client = createClient({
      url: env.redisUrl,
    });
    sessionRedisPromise = client;
    if (!client.isOpen) {
      await client.connect();
    }
  }

  return sessionRedisPromise;
}
