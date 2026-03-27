import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8000;

function loadLocalEnvFile() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '../..');
  const envPath = path.join(repoRoot, '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const fileContents = readFileSync(envPath, 'utf8');
  for (const line of fileContents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnvFile();

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  demoMode: process.env.DEMO_MODE === 'true',
  port: parseIntEnv(process.env.PORT, DEFAULT_PORT),
  host: process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  sessionSecret: process.env.SESSION_SECRET ?? 'autoxpress-dev-session-secret',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  autoxpressFeedUrl: process.env.AUTOXPRESS_FEED_URL ?? '',
  scrapeMaxVehicles: parseIntEnv(process.env.SCRAPE_MAX_VEHICLES, 8),
  scrapeMaxAutoXpressPages: parseIntEnv(process.env.SCRAPE_MAX_AUTOXPRESS_PAGES, 2),
  scrapeMaxComparablesPerSource: parseIntEnv(process.env.SCRAPE_MAX_COMPARABLES_PER_SOURCE, 4),
  doneDealEnabled: process.env.DONEDEAL_ENABLED === 'true',
  bootstrapCacheTtlMs: parseIntEnv(process.env.BOOTSTRAP_CACHE_TTL_MS, 1000 * 60 * 5),
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openrouterModel: process.env.MODEL_NAME ?? 'google/gemini-3.1-flash-lite-preview',
};

export function hasRedisConfig(): boolean {
  return Boolean(env.redisUrl);
}

export function hasDatabaseConfig(): boolean {
  return Boolean(env.databaseUrl);
}
