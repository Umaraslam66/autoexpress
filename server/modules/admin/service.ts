import { InventorySourceMode, SourceName } from '@prisma/client';
import type { AdminImportStatus, SourceJobStatus } from '../../../src/types.js';
import { prisma } from '../../lib/prisma.js';
import { mapSourceName } from '../shared/mappers.js';

export async function getAdminJobStatuses(dealershipId: string): Promise<SourceJobStatus[]> {
  const [jobRuns, inventorySources] = await Promise.all([
    prisma.jobRun.findMany({
      where: { dealershipId },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.inventorySource.findMany({
      where: { dealershipId, enabled: true },
      orderBy: { priority: 'asc' },
    }),
  ]);

  return inventorySources.map((source) => {
    const latestRun = jobRuns.find((job) => job.source === source.source) ?? null;
    return {
      source: mapSourceName(source.source),
      lastRunAt: source.lastRunAt?.toISOString() ?? latestRun?.startedAt.toISOString() ?? null,
      lastSuccessAt: source.lastSuccessAt?.toISOString() ?? latestRun?.completedAt?.toISOString() ?? null,
      latestStatus:
        latestRun?.healthStatus === 'HEALTHY'
          ? 'healthy'
          : latestRun?.healthStatus === 'DEGRADED'
            ? 'degraded'
            : 'offline',
      recordsProcessed: latestRun?.recordsProcessed ?? 0,
      message: latestRun?.message ?? 'Awaiting first run.',
    };
  });
}

export async function getAdminImportStatuses(dealershipId: string): Promise<AdminImportStatus[]> {
  const sources = await prisma.inventorySource.findMany({
    where: { dealershipId },
    orderBy: [{ source: 'asc' }, { priority: 'asc' }],
  });

  return sources.map((source) => ({
    source:
      source.source === SourceName.AUTOXPRESS && source.mode === InventorySourceMode.FEED
        ? 'autoxpress-feed'
        : mapSourceName(source.source),
    mode:
      source.mode === InventorySourceMode.FEED
        ? 'feed'
        : source.mode === InventorySourceMode.CSV
          ? 'csv'
          : 'scrape',
    enabled: source.enabled,
    configured:
      source.mode !== InventorySourceMode.FEED
        ? true
        : Boolean(source.feedUrl || process.env.AUTOXPRESS_FEED_URL),
    lastRunAt: source.lastRunAt?.toISOString() ?? null,
    notes: [
      source.mode === InventorySourceMode.FEED
        ? 'Preferred source when a structured AutoXpress feed is configured.'
        : source.mode === InventorySourceMode.CSV
          ? 'Manual admin fallback when feed and website scraping are unavailable.'
          : 'Public-site scraping source used for market and website fallback ingestion.',
    ],
  }));
}
