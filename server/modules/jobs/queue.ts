import { Queue, type ConnectionOptions } from 'bullmq';
import { getBullRedis } from '../../lib/redis.js';
import { env } from '../../config/env.js';

export const INGESTION_QUEUE_NAME = 'autoxpress-ingestion';

let ingestionQueue: Queue | null = null;

export function getIngestionQueue(): Queue | null {
  const connection = getBullRedis();
  if (!connection) {
    return null;
  }

  if (!ingestionQueue) {
    ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
      connection: connection as unknown as ConnectionOptions,
    });
  }

  return ingestionQueue;
}

export async function enqueueSyncAll(dealershipId: string) {
  const queue = getIngestionQueue();
  if (!queue) {
    return null;
  }

  return queue.add('sync-all', { dealershipId });
}

export async function enqueueSourceSync(
  dealershipId: string,
  source: 'autoxpress' | 'carzone' | 'carsireland' | 'donedeal',
) {
  const queue = getIngestionQueue();
  if (!queue) {
    return null;
  }

  return queue.add('sync-source', { dealershipId, source });
}

export async function registerRecurringJobs(dealershipId: string) {
  const queue = getIngestionQueue();
  if (!queue) {
    return;
  }

  await queue.add(
    'repeat-autoxpress',
    { dealershipId, source: 'autoxpress' },
    {
      jobId: `repeat-autoxpress-${dealershipId}`,
      repeat: { every: 1000 * 60 * 60 * 4 },
    },
  );
  await queue.add(
    'repeat-carzone',
    { dealershipId, source: 'carzone' },
    {
      jobId: `repeat-carzone-${dealershipId}`,
      repeat: { every: 1000 * 60 * 60 * 12 },
    },
  );
  await queue.add(
    'repeat-carsireland',
    { dealershipId, source: 'carsireland' },
    {
      jobId: `repeat-carsireland-${dealershipId}`,
      repeat: { every: 1000 * 60 * 60 * 12 },
    },
  );
  if (env.doneDealEnabled) {
    await queue.add(
      'repeat-donedeal',
      { dealershipId, source: 'donedeal' },
      {
        jobId: `repeat-donedeal-${dealershipId}`,
        repeat: { every: 1000 * 60 * 60 * 12 },
      },
    );
  }
}
