import { hasDatabaseConfig } from './config/env.js';
import { startWorker } from './modules/jobs/worker.js';

if (!hasDatabaseConfig()) {
  console.error('DATABASE_URL is required to start the AutoXpress worker.');
  process.exit(1);
}

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
