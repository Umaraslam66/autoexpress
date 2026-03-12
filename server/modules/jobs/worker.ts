import { Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../../config/env.js';
import { getBullRedis } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { syncAllSourcesNow, syncAutoXpressInventoryNow, syncMarketComparablesNow } from '../sources/service.js';
import { recomputeDealershipPricing } from '../pricing/service.js';
import { INGESTION_QUEUE_NAME, enqueueSyncAll, registerRecurringJobs } from './queue.js';
import { ensureSystemSeed } from '../setup/service.js';

export async function startWorker() {
  if (env.demoMode) {
    console.log('Demo mode is enabled; background scraping worker is disabled.');
    return null;
  }

  const dealership = await ensureSystemSeed();
  await registerRecurringJobs(dealership.id);

  // On first deploy with an empty database, immediately queue a full sync
  // so the client sees real data without having to trigger a manual refresh.
  const vehicleCount = await prisma.vehicle.count({ where: { dealershipId: dealership.id } });
  if (vehicleCount === 0) {
    console.log('[Worker] Empty database detected — queuing initial full sync.');
    const queued = await enqueueSyncAll(dealership.id);
    if (!queued) {
      // Redis not available yet, run directly in background
      syncAllSourcesNow(dealership.id).catch((err) => console.error('[Worker] Initial sync failed:', err));
    }
  }

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
