import { Worker, type ConnectionOptions } from 'bullmq';
import { getBullRedis } from '../../lib/redis.js';
import { syncAllSourcesNow, syncAutoXpressInventoryNow, syncMarketComparablesNow } from '../sources/service.js';
import { recomputeDealershipPricing } from '../pricing/service.js';
import { INGESTION_QUEUE_NAME, registerRecurringJobs } from './queue.js';
import { ensureSystemSeed } from '../setup/service.js';

export async function startWorker() {
  const dealership = await ensureSystemSeed();
  await registerRecurringJobs(dealership.id);

  const connection = getBullRedis();
  if (!connection) {
    console.log('Redis is not configured; BullMQ worker was not started.');
    return null;
  }

  const worker = new Worker(
    INGESTION_QUEUE_NAME,
    async (job) => {
      if (job.name === 'sync-all') {
        await syncAllSourcesNow(job.data.dealershipId);
        return;
      }

      const source = job.data.source as 'autoxpress' | 'carzone' | 'carsireland';
      if (source === 'autoxpress') {
        await syncAutoXpressInventoryNow(job.data.dealershipId);
      } else {
        await syncMarketComparablesNow(job.data.dealershipId, source);
      }

      await recomputeDealershipPricing(job.data.dealershipId);
    },
    {
      connection: connection as unknown as ConnectionOptions,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(`Worker job ${job?.name ?? 'unknown'} failed`, error);
  });

  worker.on('completed', (job) => {
    console.log(`Worker job ${job.name} completed`);
  });

  return worker;
}
