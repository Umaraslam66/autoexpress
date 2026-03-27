import { Redis } from 'ioredis';
import { env, hasRedisConfig } from '../config/env.js';

type BullRedisClient = InstanceType<typeof Redis>;
type SessionRedisClient = {
  isOpen: boolean;
  connect: () => Promise<unknown>;
};

let bullRedis: BullRedisClient | null = null;
let sessionRedisPromise: Promise<SessionRedisClient> | null = null;

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
    sessionRedisPromise = import('redis').then(async ({ createClient }) => {
      const client = createClient({
        url: env.redisUrl,
      }) as unknown as SessionRedisClient;
      if (!client.isOpen) {
        await client.connect();
      }
      return client;
    });
  }

  return sessionRedisPromise;
}
