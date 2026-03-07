const DEFAULT_PORT = 8000;

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseIntEnv(process.env.PORT, DEFAULT_PORT),
  sessionSecret: process.env.SESSION_SECRET ?? 'autoxpress-dev-session-secret',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  autoxpressFeedUrl: process.env.AUTOXPRESS_FEED_URL ?? '',
  scrapeMaxVehicles: parseIntEnv(process.env.SCRAPE_MAX_VEHICLES, 8),
  scrapeMaxAutoXpressPages: parseIntEnv(process.env.SCRAPE_MAX_AUTOXPRESS_PAGES, 2),
  scrapeMaxComparablesPerSource: parseIntEnv(process.env.SCRAPE_MAX_COMPARABLES_PER_SOURCE, 4),
  bootstrapCacheTtlMs: parseIntEnv(process.env.BOOTSTRAP_CACHE_TTL_MS, 1000 * 60 * 5),
};

export function hasRedisConfig(): boolean {
  return Boolean(env.redisUrl);
}

export function hasDatabaseConfig(): boolean {
  return Boolean(env.databaseUrl);
}
