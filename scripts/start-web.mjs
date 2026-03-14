import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const isDemoMode = process.env.DEMO_MODE === 'true';
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasPrismaMigrations() {
  const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
  return existsSync(migrationsDir) && readdirSync(migrationsDir).some((entry) => entry !== '.DS_Store');
}

if (!isDemoMode && hasDatabaseUrl) {
  if (hasPrismaMigrations()) {
    run('npx', ['prisma', 'migrate', 'deploy']);
  } else {
    run('npx', ['prisma', 'db', 'push', '--skip-generate']);
  }
}

run('node', ['dist-server/server/index.js']);
