import type { ApiBootstrapData, ComparableListing, PricingDecision, PricingFileRecord, Vehicle } from '../../../src/types.js';
import {
  comparableListings as demoComparableListings,
  jobRuns as demoJobRuns,
  normalizationRules as demoNormalizationRules,
  sourceHealth as demoSourceHealth,
  users as demoUsers,
  vehicles as demoVehicles,
} from '../../../src/data/mockData.js';
import { buildVehicleInsights } from '../../../src/utils/vehicleAnalysis.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { ensureSystemSeed } from '../setup/service.js';
import {
  toAppUser,
  toComparableListingDto,
  toJobRunDto,
  toNormalizationRuleDto,
  toPricingDecisionDto,
  toPricingFileDto,
  toSourceHealth,
  toVehicleDto,
} from '../shared/mappers.js';

function latestByVehicleId<T extends { vehicleId: string }>(items: T[], getDate: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) {
    const existing = map.get(item.vehicleId);
    const nextDate = new Date(getDate(item)).getTime();
    const existingDate = existing ? new Date(getDate(existing)).getTime() : 0;
    if (!existing || nextDate > existingDate) {
      map.set(item.vehicleId, item);
    }
  }
  return map;
}

function buildDemoBootstrap(currentUserId?: string | null): ApiBootstrapData {
  const pricingDecisions: Record<string, PricingDecision> = {};
  const excludedComparables: Record<string, string[]> = {};
  const pricingFiles: PricingFileRecord[] = [];
  const insights = buildVehicleInsights(
    demoVehicles,
    demoComparableListings,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
  );

  return {
    users: demoUsers,
    vehicles: demoVehicles,
    comparableListings: demoComparableListings,
    sourceHealth: demoSourceHealth,
    jobRuns: demoJobRuns,
    normalizationRules: demoNormalizationRules,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
    currentUser: demoUsers.find((user) => user.id === currentUserId) ?? demoUsers[0] ?? null,
    dashboard: {
      totalVehicles: demoVehicles.length,
      sufficientComparables: insights.filter((insight) => insight.pricing.comparableCount >= 3).length,
      needingReview: insights.filter((insight) => insight.needsReview).length,
      aboveMarket: insights.filter((insight) => insight.pricing.currentPosition === 'above_market').length,
      belowMarket: insights.filter((insight) => insight.pricing.currentPosition === 'below_market').length,
      averageDaysInStock:
        insights.length === 0
          ? 0
          : Math.round(
              insights.reduce(
                (total, insight) =>
                  total + Math.max(0, Math.round((Date.now() - new Date(insight.vehicle.dateAdded).getTime()) / (1000 * 60 * 60 * 24))),
                0,
              ) / insights.length,
            ),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: 'seed',
      messages: [
        'Demo mode is active. The dashboard is using curated sample data for client review.',
        'Live scraping, background sync, and database-backed write actions are disabled in this environment.',
      ],
    },
  };
}

export async function getBootstrapData(currentUserId?: string | null): Promise<ApiBootstrapData> {
  if (env.demoMode) {
    return buildDemoBootstrap(currentUserId);
  }

  const dealership = await ensureSystemSeed();

  const [users, normalizationRules, inventorySources, jobRuns, vehicles, matches, decisions, pricingFiles] = await Promise.all([
    prisma.user.findMany({
      where: { dealershipId: dealership.id },
      orderBy: { name: 'asc' },
    }),
    prisma.normalizationRule.findMany({
      where: { dealershipId: dealership.id },
      orderBy: [{ dictionary: 'asc' }, { sourceValue: 'asc' }],
    }),
    prisma.inventorySource.findMany({
      where: { dealershipId: dealership.id, enabled: true },
      orderBy: [{ source: 'asc' }, { priority: 'asc' }],
    }),
    prisma.jobRun.findMany({
      where: { dealershipId: dealership.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    }),
    prisma.vehicle.findMany({
      where: { dealershipId: dealership.id },
      include: {
        snapshots: {
          orderBy: { capturedAt: 'asc' },
        },
      },
      orderBy: { dateAdded: 'desc' },
    }),
    prisma.vehicleMatch.findMany({
      where: { dealershipId: dealership.id },
      include: { normalizedListing: true },
      orderBy: { score: 'desc' },
    }),
    prisma.pricingDecision.findMany({
      where: { dealershipId: dealership.id },
      include: { user: true },
      orderBy: { decidedAt: 'desc' },
    }),
    prisma.pricingFile.findMany({
      where: { dealershipId: dealership.id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const currentUser = currentUserId
    ? users.find((user) => user.id === currentUserId) ?? null
    : null;

  const vehicleDtos = vehicles.map(toVehicleDto);
  const comparableListings = matches.map(toComparableListingDto);
  const decisionDtos = decisions.map(toPricingDecisionDto);
  const pricingFileDtos = pricingFiles.map(toPricingFileDto);
  const latestDecisionMap = latestByVehicleId(decisionDtos, (decision) => decision.decidedAt);

  const excludedComparableRows = await prisma.excludedComparable.findMany({
    where: { dealershipId: dealership.id },
  });
  const excludedComparables = excludedComparableRows.reduce<Record<string, string[]>>((accumulator, row) => {
    accumulator[row.vehicleId] = accumulator[row.vehicleId] ?? [];
    accumulator[row.vehicleId].push(row.normalizedListingId);
    return accumulator;
  }, {});

  const pricingDecisions = Array.from(latestDecisionMap.entries()).reduce<Record<string, PricingDecision>>(
    (accumulator, [vehicleId, decision]) => {
      accumulator[vehicleId] = decision;
      return accumulator;
    },
    {},
  );

  const latestJobRunsBySource = jobRuns.reduce<Map<string, (typeof jobRuns)[number]>>((accumulator, run) => {
    const key = `${run.source}`;
    if (!accumulator.has(key)) {
      accumulator.set(key, run);
    }
    return accumulator;
  }, new Map());

  const distinctSourceHealth = Array.from(
    inventorySources.reduce<Map<string, (typeof inventorySources)[number]>>((accumulator, source) => {
      const key = `${source.source}`;
      if (!accumulator.has(key)) {
        accumulator.set(key, source);
      }
      return accumulator;
    }, new Map()).values(),
  );

  const sourceHealth = distinctSourceHealth.map((source) =>
    toSourceHealth(source, latestJobRunsBySource.get(`${source.source}`) ?? null),
  );

  const insights = buildVehicleInsights(
    vehicleDtos,
    comparableListings,
    pricingDecisions,
    excludedComparables,
    pricingFileDtos,
  );

  const aboveMarket = insights.filter((insight) => insight.pricing.currentPosition === 'above_market').length;
  const belowMarket = insights.filter((insight) => insight.pricing.currentPosition === 'below_market').length;
  const sufficientComparables = insights.filter((insight) => insight.pricing.comparableCount >= 3).length;
  const needingReview = insights.filter((insight) => insight.needsReview).length;
  const averageDaysInStock =
    insights.length === 0
      ? 0
      : Math.round(
          insights.reduce((total, insight) => total + Math.max(0, Math.round((Date.now() - new Date(insight.vehicle.dateAdded).getTime()) / (1000 * 60 * 60 * 24))), 0) /
            insights.length,
        );

  return {
    users: users.map(toAppUser),
    vehicles: vehicleDtos,
    comparableListings,
    sourceHealth,
    jobRuns: jobRuns.map(toJobRunDto),
    normalizationRules: normalizationRules.map(toNormalizationRuleDto),
    pricingDecisions,
    excludedComparables,
    pricingFiles: pricingFileDtos,
    currentUser: currentUser ? toAppUser(currentUser) : null,
    dashboard: {
      totalVehicles: vehicleDtos.length,
      sufficientComparables,
      needingReview,
      aboveMarket,
      belowMarket,
      averageDaysInStock,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: 'live',
      messages: ['Live data is being served from PostgreSQL-backed source syncs.'],
    },
  };
}

export async function getVehicleDetail(dealershipId: string, vehicleId: string) {
  const bootstrap = await getBootstrapData();
  const vehicle = bootstrap.vehicles.find((candidate) => candidate.id === vehicleId);

  if (!vehicle) {
    return null;
  }

  const comparables = bootstrap.comparableListings.filter((listing) => listing.vehicleId === vehicleId);
  const decision = bootstrap.pricingDecisions[vehicleId] ?? null;
  const excludedComparableIds = bootstrap.excludedComparables[vehicleId] ?? [];
  const latestPricingFile = bootstrap.pricingFiles.find((record) => record.vehicleId === vehicleId) ?? null;

  return {
    vehicle,
    comparables,
    decision,
    excludedComparableIds,
    latestPricingFile,
  };
}

export async function listPricingFiles(dealershipId: string): Promise<PricingFileRecord[]> {
  const files = await prisma.pricingFile.findMany({
    where: { dealershipId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return files.map(toPricingFileDto);
}
