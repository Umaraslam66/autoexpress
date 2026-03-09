import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { env } from '../config/env.js';
import { getSessionRedisClient } from './redis.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    dealershipId?: string;
  }
}

export async function createSessionMiddleware() {
  const redisClient = await getSessionRedisClient();

  if (redisClient) {
    return session({
      name: 'autoxpress.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: env.nodeEnv === 'production',
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
      store: new RedisStore({
        client: redisClient,
        prefix: 'autoxpress:sess:',
      }),
    });
  }

  return session({
    name: 'autoxpress.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: env.nodeEnv === 'production',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 12,
    },
  });
}
