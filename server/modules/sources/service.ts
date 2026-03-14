import {
  InventorySourceMode,
  JobStatus,
  ListingKind,
  MatchConfidence,
  SourceHealthStatus,
  SourceName,
  VehicleStatus,
  type Prisma,
} from '@prisma/client';
import type { ComparableListing, Vehicle } from '../../../src/types.js';
import type { RawScrapedListing } from '../../scrapers/rawTypes.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/http.js';
import { scoreComparable } from '../../lib/matching.js';
import { scrapeCarzoneMakeModel } from '../../scrapers/carzone.js';
import { scrapeCarsIrelandMakeModel } from '../../scrapers/carsIreland.js';
import { syncAutoXpressFeedInventory } from './adapters/autoxpressFeed.js';
import { syncAutoXpressWebInventory } from './adapters/autoxpressWeb.js';
import { recomputeDealershipPricing } from '../pricing/service.js';

// Maximum number of unique (make, model) groups to scrape concurrently.
// Each group fires one browser session; 4 concurrent keeps memory reasonable
// while being ~4x faster than the old per-vehicle sequential approach.
const CONCURRENT_SCRAPE_GROUPS = 4;

/**
 * Run an array of async tasks with a maximum concurrency limit, collecting
 * all results (fulfilled and rejected) before returning.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = await Promise.allSettled(tasks.slice(i, i + limit).map((fn) => fn()));
    results.push(...batch);
  }
  return results;
}

type DbVehicle = Awaited<ReturnType<typeof prisma.vehicle.findMany>>[number];

function toVehicleDto(vehicle: DbVehicle): Vehicle {
  return {
    id: vehicle.id,
    stockId: vehicle.stockId,
    registration: vehicle.registration,
    vinFragment: vehicle.vinFragment ?? undefined,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant,
    year: vehicle.year,
    mileageKm: vehicle.mileageKm,
    fuel: vehicle.fuel,
    transmission: vehicle.transmission,
    bodyType: vehicle.bodyType,
    engineLitres: vehicle.engineLitres,
    colour: vehicle.colour,
    price: vehicle.price,
    status: 'active',
    dateAdded: vehicle.dateAdded.toISOString(),
    location: vehicle.location,
    vehicleUrl: vehicle.vehicleUrl,
    imageUrl: vehicle.imageUrl,
    notes: [],
    priceHistory: [],
  };
}

/** Convert a raw scraped listing into a scored ComparableListing for a specific vehicle. */
function rawToComparable(vehicle: Vehicle, raw: RawScrapedListing): ComparableListing {
  const comparable: ComparableListing = {
    id: `${raw.source}-${raw.listingId}`,
    vehicleId: vehicle.id,
    source: raw.source,
    listingId: raw.listingId,
    listingUrl: raw.listingUrl,
    title: raw.title,
    make: raw.make,
    model: raw.model,
    variant: raw.variant,
    year: raw.year || vehicle.year,
    mileageKm: raw.mileageKm,
    fuel: raw.fuel,
    transmission: raw.transmission,
    bodyType: raw.bodyType,
    engineLitres: raw.engineLitres,
    price: raw.price,
    dealerName: raw.dealerName,
    dealerLocation: raw.dealerLocation,
    listedAt: raw.scrapedAt,
    daysListed: 0,
    imageUrl: raw.imageUrl,
    lastSeenAt: raw.scrapedAt,
    matchScore: 0,
    confidence: 'low',
    explanation: [],
  };

  const scoring = scoreComparable(vehicle, comparable);
  comparable.matchScore = scoring.score;
  comparable.confidence = scoring.confidence;
  comparable.explanation = scoring.explanation;
  return comparable;
}

type ComparableSourceName = typeof SourceName.CARZONE | typeof SourceName.CARSIRELAND;

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function mapConfidence(confidence: ComparableListing['confidence']): MatchConfidence {
  switch (confidence) {
    case 'high':
      return MatchConfidence.HIGH;
    case 'medium':
      return MatchConfidence.MEDIUM;
    case 'low':
    default:
      return MatchConfidence.LOW;
  }
}

function mapVehicleStatus(status: Vehicle['status']): VehicleStatus {
  switch (status) {
    case 'sold':
      return VehicleStatus.SOLD;
    case 'incoming':
      return VehicleStatus.INCOMING;
    case 'active':
    default:
      return VehicleStatus.ACTIVE;
  }
}

function mapSource(source: ComparableListing['source']): SourceName {
  switch (source) {
    case 'carzone':
      return SourceName.CARZONE;
    case 'carsireland':
      return SourceName.CARSIRELAND;
    case 'autoxpress':
    default:
      return SourceName.AUTOXPRESS;
  }
}

function sanitizeDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function createSourceRun(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    dealershipId: string;
    source: SourceName;
    mode: InventorySourceMode;
    inventorySourceId?: string;
    message: string;
  },
) {
  return tx.sourceRun.create({
    data: {
      dealershipId: input.dealershipId,
      inventorySourceId: input.inventorySourceId,
      source: input.source,
      mode: input.mode,
      status: JobStatus.WARNING,
      message: input.message,
    },
  });
}

async function finalizeSourceRun(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    sourceRunId: string;
    inventorySourceId?: string;
    status: JobStatus;
    healthStatus: SourceHealthStatus;
    recordsProcessed: number;
    message: string;
  },
) {
  const completedAt = new Date();
  await tx.sourceRun.update({
    where: { id: input.sourceRunId },
    data: {
      status: input.status,
      completedAt,
      recordsProcessed: input.recordsProcessed,
      message: input.message,
    },
  });

  await tx.jobRun.create({
    data: {
      dealershipId: (await tx.sourceRun.findUniqueOrThrow({ where: { id: input.sourceRunId }, select: { dealershipId: true } })).dealershipId,
      source: (await tx.sourceRun.findUniqueOrThrow({ where: { id: input.sourceRunId }, select: { source: true } })).source,
      status: input.status,
      completedAt,
      recordsProcessed: input.recordsProcessed,
      message: input.message,
      healthStatus: input.healthStatus,
    },
  });

  if (input.inventorySourceId) {
    await tx.inventorySource.update({
      where: { id: input.inventorySourceId },
      data: {
        lastRunAt: completedAt,
        lastSuccessAt:
          input.status === JobStatus.SUCCESS || input.status === JobStatus.WARNING ? completedAt : undefined,
      },
    });
  }
}

async function persistVehicle(
  tx: Prisma.TransactionClient,
  dealershipId: string,
  sourceRunId: string,
  vehicle: Vehicle,
) {
  const persisted = await tx.vehicle.upsert({
    where: {
      dealershipId_source_externalId: {
        dealershipId,
        source: SourceName.AUTOXPRESS,
        externalId: vehicle.stockId,
      },
    },
    update: {
      stockId: vehicle.stockId,
      registration: vehicle.registration,
      vinFragment: vehicle.vinFragment ?? null,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      year: vehicle.year,
      mileageKm: vehicle.mileageKm,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      bodyType: vehicle.bodyType,
      engineLitres: vehicle.engineLitres,
      colour: vehicle.colour,
      price: vehicle.price,
      status: mapVehicleStatus(vehicle.status),
      dateAdded: sanitizeDate(vehicle.dateAdded) ?? new Date(),
      location: vehicle.location,
      vehicleUrl: vehicle.vehicleUrl,
      imageUrl: vehicle.imageUrl,
      notesJson: toInputJsonValue(vehicle.notes),
      sourceRunId,
      lastSeenAt: new Date(),
    },
    create: {
      dealershipId,
      source: SourceName.AUTOXPRESS,
      externalId: vehicle.stockId,
      stockId: vehicle.stockId,
      registration: vehicle.registration,
      vinFragment: vehicle.vinFragment ?? null,
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      year: vehicle.year,
      mileageKm: vehicle.mileageKm,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      bodyType: vehicle.bodyType,
      engineLitres: vehicle.engineLitres,
      colour: vehicle.colour,
      price: vehicle.price,
      status: mapVehicleStatus(vehicle.status),
      dateAdded: sanitizeDate(vehicle.dateAdded) ?? new Date(),
      location: vehicle.location,
      vehicleUrl: vehicle.vehicleUrl,
      imageUrl: vehicle.imageUrl,
      notesJson: toInputJsonValue(vehicle.notes),
      sourceRunId,
    },
  });

  await tx.vehicleSnapshot.create({
    data: {
      vehicleId: persisted.id,
      sourceRunId,
      price: vehicle.price,
      mileageKm: vehicle.mileageKm,
      status: mapVehicleStatus(vehicle.status),
      snapshotJson: toInputJsonValue(vehicle),
    },
  });

  return persisted;
}

async function persistComparable(
  tx: Prisma.TransactionClient,
  dealershipId: string,
  sourceRunId: string,
  vehicleId: string,
  comparable: ComparableListing,
  rawPayload: unknown,
) {
  const rawListing = await tx.rawListing.create({
    data: {
      dealershipId,
      sourceRunId,
      source: mapSource(comparable.source),
      kind: ListingKind.COMPARABLE,
      externalId: comparable.listingId,
      listingUrl: comparable.listingUrl,
      payloadJson: toInputJsonValue(rawPayload),
    },
  });

  const normalizedListing = await tx.normalizedListing.upsert({
    where: {
      dealershipId_source_externalId: {
        dealershipId,
        source: mapSource(comparable.source),
        externalId: comparable.listingId,
      },
    },
    update: {
      rawListingId: rawListing.id,
      listingUrl: comparable.listingUrl,
      title: comparable.title,
      make: comparable.make,
      model: comparable.model,
      variant: comparable.variant,
      year: comparable.year,
      mileageKm: comparable.mileageKm,
      fuel: comparable.fuel,
      transmission: comparable.transmission,
      bodyType: comparable.bodyType,
      engineLitres: comparable.engineLitres ?? null,
      price: comparable.price,
      dealerName: comparable.dealerName,
      dealerLocation: comparable.dealerLocation,
      listedAt: sanitizeDate(comparable.listedAt),
      daysListed: comparable.daysListed,
      imageUrl: comparable.imageUrl ?? null,
      lastSeenAt: sanitizeDate(comparable.lastSeenAt) ?? new Date(),
      rawValuesJson: toInputJsonValue(comparable),
      isActive: true,
    },
    create: {
      dealershipId,
      rawListingId: rawListing.id,
      source: mapSource(comparable.source),
      externalId: comparable.listingId,
      listingUrl: comparable.listingUrl,
      title: comparable.title,
      make: comparable.make,
      model: comparable.model,
      variant: comparable.variant,
      year: comparable.year,
      mileageKm: comparable.mileageKm,
      fuel: comparable.fuel,
      transmission: comparable.transmission,
      bodyType: comparable.bodyType,
      engineLitres: comparable.engineLitres ?? null,
      price: comparable.price,
      dealerName: comparable.dealerName,
      dealerLocation: comparable.dealerLocation,
      listedAt: sanitizeDate(comparable.listedAt),
      daysListed: comparable.daysListed,
      imageUrl: comparable.imageUrl ?? null,
      lastSeenAt: sanitizeDate(comparable.lastSeenAt) ?? new Date(),
      rawValuesJson: toInputJsonValue(comparable),
    },
  });

  await tx.vehicleMatch.upsert({
    where: {
      vehicleId_normalizedListingId: {
        vehicleId,
        normalizedListingId: normalizedListing.id,
      },
    },
    update: {
      dealershipId,
      score: comparable.matchScore,
      confidence: mapConfidence(comparable.confidence),
      explanationJson: comparable.explanation,
      included: true,
      lastEvaluatedAt: new Date(),
    },
    create: {
      dealershipId,
      vehicleId,
      normalizedListingId: normalizedListing.id,
      score: comparable.matchScore,
      confidence: mapConfidence(comparable.confidence),
      explanationJson: comparable.explanation,
      included: true,
    },
  });
}

export async function syncAutoXpressInventoryNow(dealershipId: string) {
  const inventorySources = await prisma.inventorySource.findMany({
    where: {
      dealershipId,
      source: SourceName.AUTOXPRESS,
      enabled: true,
    },
    orderBy: { priority: 'asc' },
  });

  const feedSource = inventorySources.find((source) => source.mode === InventorySourceMode.FEED);
  const scrapeSource = inventorySources.find((source) => source.mode === InventorySourceMode.SCRAPE);

  let mode: InventorySourceMode = InventorySourceMode.SCRAPE;
  let inventorySourceId = scrapeSource?.id;
  let vehicles: Vehicle[] = [];
  let message = '';
  let rawPayloads: Array<{ externalId: string; listingUrl?: string; payload: unknown }> = [];

  const sourceRun = await createSourceRun(prisma, {
    dealershipId,
    source: SourceName.AUTOXPRESS,
    mode: InventorySourceMode.SCRAPE,
    inventorySourceId: inventorySourceId,
    message: 'Starting AutoXpress inventory sync.',
  });

  try {
    let feedFailureMessage = '';
    try {
      const feedResult = await syncAutoXpressFeedInventory(feedSource?.feedUrl ?? env.autoxpressFeedUrl);
      if (feedResult) {
        mode = InventorySourceMode.FEED;
        inventorySourceId = feedSource?.id;
        vehicles = feedResult.vehicles;
        rawPayloads = feedResult.rawPayloads;
        message = feedResult.message;
      }
    } catch (error) {
      feedFailureMessage = error instanceof Error ? error.message : 'Feed ingest failed.';
    }

    if (!vehicles.length) {
      const scrapeResult = await syncAutoXpressWebInventory();
      mode = InventorySourceMode.SCRAPE;
      inventorySourceId = scrapeSource?.id;
      vehicles = scrapeResult.vehicles;
      rawPayloads = scrapeResult.rawPayloads;
      message = feedFailureMessage
        ? `${scrapeResult.message} Feed fallback triggered after: ${feedFailureMessage}`
        : scrapeResult.message;
    }

    await prisma.$transaction(async (tx) => {
      for (const [index, vehicle] of vehicles.entries()) {
        await persistVehicle(tx, dealershipId, sourceRun.id, vehicle);
        await tx.rawListing.create({
          data: {
            dealershipId,
            sourceRunId: sourceRun.id,
            source: SourceName.AUTOXPRESS,
            kind: ListingKind.INVENTORY,
            externalId: vehicle.stockId,
            listingUrl: vehicle.vehicleUrl,
            payloadJson: toInputJsonValue(rawPayloads[index]?.payload ?? vehicle),
          },
        });
      }

      await tx.sourceRun.update({
        where: { id: sourceRun.id },
        data: {
          mode,
          inventorySourceId,
        },
      });
    });

    await finalizeSourceRun(prisma, {
      sourceRunId: sourceRun.id,
      inventorySourceId,
      status: JobStatus.SUCCESS,
      healthStatus: SourceHealthStatus.HEALTHY,
      recordsProcessed: vehicles.length,
      message,
    });

    return {
      recordsProcessed: vehicles.length,
      message,
    };
  } catch (error) {
    await finalizeSourceRun(prisma, {
      sourceRunId: sourceRun.id,
      inventorySourceId,
      status: JobStatus.FAILED,
      healthStatus: SourceHealthStatus.OFFLINE,
      recordsProcessed: 0,
      message: error instanceof Error ? error.message : 'Inventory sync failed.',
    });
    throw error;
  }
}

async function syncComparableSource(
  dealershipId: string,
  source: ComparableSourceName,
) {
  const inventorySource = await prisma.inventorySource.findFirst({
    where: { dealershipId, source, enabled: true },
  });

  const vehicles = await prisma.vehicle.findMany({
    where: { dealershipId, status: VehicleStatus.ACTIVE },
  });

  if (!vehicles.length) {
    throw new HttpError(409, 'No vehicles are available to match against competitor sites.');
  }

  const sourceRun = await createSourceRun(prisma, {
    dealershipId,
    source,
    mode: InventorySourceMode.SCRAPE,
    inventorySourceId: inventorySource?.id,
    message: `Starting ${source.toLowerCase()} comparable sync.`,
  });

  // ── Deduplication: group vehicles by (make, model) ──────────────────────
  // Instead of launching one browser session per vehicle, we scrape each
  // unique make/model combination ONCE and re-use those results for every
  // vehicle that shares the same make/model.
  //
  // Example: 15 VW Golfs → 1 browser session instead of 15.
  // For 489 vehicles with ~80 unique combos: 978 sessions → ~160 sessions.
  const groups = new Map<string, DbVehicle[]>();
  for (const vehicle of vehicles) {
    const key = `${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}`;
    const group = groups.get(key) ?? [];
    group.push(vehicle);
    groups.set(key, group);
  }

  const uniqueGroups = [...groups.entries()];
  console.log(
    `[${source}] Deduplication: ${vehicles.length} vehicles → ` +
    `${uniqueGroups.length} unique make/model pairs (${CONCURRENT_SCRAPE_GROUPS} concurrent)`,
  );

  let recordsProcessed = 0;
  let groupsCompleted = 0;

  const groupTasks = uniqueGroups.map(([key, groupVehicles]) => async () => {
    const [make, model] = key.split('|');

    // One browser session per make/model combination
    let rawListings: RawScrapedListing[];
    try {
      rawListings =
        source === SourceName.CARZONE
          ? await scrapeCarzoneMakeModel(make, model)
          : await scrapeCarsIrelandMakeModel(make, model);
    } catch (err) {
      console.error(`[${source}] Failed to scrape ${make} ${model}:`, (err as Error).message);
      return 0;
    }

    if (!rawListings.length) {
      console.warn(`[${source}] No results for ${make} ${model}`);
      return 0;
    }

    let groupRecords = 0;

    // Score and persist independently for each vehicle in this make/model group
    for (const dbVehicle of groupVehicles) {
      const vehicleDto = toVehicleDto(dbVehicle);

      const scoredListings = rawListings
        .map((raw) => rawToComparable(vehicleDto, raw))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, env.scrapeMaxComparablesPerSource);

      try {
        await prisma.$transaction(async (tx) => {
          for (const listing of scoredListings) {
            await persistComparable(tx, dealershipId, sourceRun.id, dbVehicle.id, listing, listing);
          }
        });
        groupRecords += scoredListings.length;
      } catch (err) {
        console.error(
          `[${source}] Failed to persist comparables for vehicle ${dbVehicle.stockId}:`,
          (err as Error).message,
        );
      }
    }

    groupsCompleted += 1;
    recordsProcessed += groupRecords;
    console.log(
      `[${source}] ${groupsCompleted}/${uniqueGroups.length} groups done — ` +
      `${make} ${model}: ${rawListings.length} raw → ${groupRecords} persisted across ${groupVehicles.length} vehicles`,
    );

    return groupRecords;
  });

  try {
    await runWithConcurrency(groupTasks, CONCURRENT_SCRAPE_GROUPS);

    await finalizeSourceRun(prisma, {
      sourceRunId: sourceRun.id,
      inventorySourceId: inventorySource?.id,
      status: JobStatus.SUCCESS,
      healthStatus: SourceHealthStatus.HEALTHY,
      recordsProcessed,
      message:
        `Persisted ${recordsProcessed} ${source.toLowerCase()} comparable listings ` +
        `from ${uniqueGroups.length} unique make/model pairs (${vehicles.length} vehicles).`,
    });

    return { recordsProcessed };
  } catch (error) {
    await finalizeSourceRun(prisma, {
      sourceRunId: sourceRun.id,
      inventorySourceId: inventorySource?.id,
      status: JobStatus.WARNING,
      healthStatus: SourceHealthStatus.DEGRADED,
      recordsProcessed,
      message: error instanceof Error ? error.message : 'Comparable sync failed.',
    });
    throw error;
  }
}

export async function syncMarketComparablesNow(dealershipId: string, source: 'carzone' | 'carsireland') {
  return syncComparableSource(
    dealershipId,
    source === 'carzone' ? SourceName.CARZONE : SourceName.CARSIRELAND,
  );
}

export async function syncAllSourcesNow(dealershipId: string) {
  const messages: string[] = [];
  const inventoryResult = await syncAutoXpressInventoryNow(dealershipId);
  messages.push(inventoryResult.message);

  for (const source of ['carzone', 'carsireland'] as const) {
    try {
      const result = await syncMarketComparablesNow(dealershipId, source);
      messages.push(`Synced ${result.recordsProcessed} ${source} listings.`);
    } catch (error) {
      messages.push(error instanceof Error ? error.message : `Failed to sync ${source}.`);
    }
  }

  await recomputeDealershipPricing(dealershipId);
  return messages;
}
