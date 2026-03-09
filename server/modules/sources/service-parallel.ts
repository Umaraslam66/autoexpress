import {
  InventorySourceMode,
  JobStatus,
  SourceName,
  VehicleStatus,
  type Prisma,
} from '@prisma/client';
import type { ComparableListing, Vehicle } from '../../../src/types.js';
import { prisma } from '../../lib/prisma.js';
import { syncCarzoneComparables } from './adapters/carzoneWeb.js';
import { syncCarsIrelandComparables } from './adapters/carsIrelandWeb.js';

// Parallel processing configuration
const BATCH_SIZE = 2; // Process 2 vehicles concurrently (avoids deadlocks)

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
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapConfidence(confidence: ComparableListing['confidence']) {
  switch (confidence) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
    default:
      return 'LOW';
  }
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
      kind: 'COMPARABLE',
      externalId: comparable.listingId,
      listingUrl: comparable.listingUrl,
      payloadJson: rawPayload as Prisma.InputJsonValue,
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
      rawValuesJson: comparable as unknown as Prisma.InputJsonValue,
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
      rawValuesJson: comparable as unknown as Prisma.InputJsonValue,
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
      confidence: mapConfidence(comparable.confidence) as any,
      explanationJson: comparable.explanation,
      included: true,
      lastEvaluatedAt: new Date(),
    },
    create: {
      dealershipId,
      vehicleId,
      normalizedListingId: normalizedListing.id,
      score: comparable.matchScore,
      confidence: mapConfidence(comparable.confidence) as any,
      explanationJson: comparable.explanation,
      included: true,
    },
  });
}

export async function syncMarketComparablesParallel(
  dealershipId: string,
  source: 'carzone' | 'carsireland',
) {
  const sourceName = source === 'carzone' ? SourceName.CARZONE : SourceName.CARSIRELAND;

  const inventorySource = await prisma.inventorySource.findFirst({
    where: { dealershipId, source: sourceName, enabled: true },
  });

  const vehicles = await prisma.vehicle.findMany({
    where: {
      dealershipId,
      status: VehicleStatus.ACTIVE,
    },
  });

  if (!vehicles.length) {
    throw new Error('No vehicles are available to match against competitor sites.');
  }

  const sourceRun = await prisma.sourceRun.create({
    data: {
      dealershipId,
      inventorySourceId: inventorySource?.id,
      source: sourceName,
      mode: InventorySourceMode.SCRAPE,
      status: JobStatus.WARNING,
      message: `Starting ${source} parallel comparable sync.`,
    },
  });

  let recordsProcessed = 0;
  let processedVehicles = 0;

  try {
    console.log(`\n🚀 Processing ${vehicles.length} vehicles in batches of ${BATCH_SIZE}...\n`);

    // Process vehicles in batches
    for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
      const batch = vehicles.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(vehicles.length / BATCH_SIZE);

      console.log(`📦 Batch ${batchNum}/${totalBatches}: Processing vehicles ${i + 1}-${Math.min(i + BATCH_SIZE, vehicles.length)}...`);

      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(async (vehicle) => {
          const vehicleDto: Vehicle = {
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

          const result =
            source === 'carzone'
              ? await syncCarzoneComparables(vehicleDto)
              : await syncCarsIrelandComparables(vehicleDto);

          // Persist to database
          await prisma.$transaction(async (tx) => {
            for (const [index, listing] of result.listings.entries()) {
              await persistComparable(
                tx,
                dealershipId,
                sourceRun.id,
                vehicle.id,
                listing,
                result.rawPayloads[index]?.payload ?? listing,
              );
            }
          });

          return result.listings.length;
        })
      );

      // Count successful results
      let batchRecords = 0;
      let batchSuccesses = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          batchRecords += result.value;
          batchSuccesses++;
        } else {
          console.error(`  ⚠️  Vehicle failed:`, result.reason.message);
        }
      }

      recordsProcessed += batchRecords;
      processedVehicles += batchSuccesses;

      console.log(`  ✓ Batch complete: ${batchRecords} listings from ${batchSuccesses}/${batch.length} vehicles`);
      console.log(`  Progress: ${processedVehicles}/${vehicles.length} vehicles (${recordsProcessed} total listings)\n`);
    }

    await prisma.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: JobStatus.SUCCESS,
        recordsProcessed,
        completedAt: new Date(),
        message: `Persisted ${recordsProcessed} ${source} comparable listings from ${processedVehicles} vehicles.`,
      },
    });

    if (inventorySource) {
      await prisma.inventorySource.update({
        where: { id: inventorySource.id },
        data: {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
        },
      });
    }

    return { recordsProcessed };
  } catch (error) {
    await prisma.sourceRun.update({
      where: { id: sourceRun.id },
      data: {
        status: JobStatus.WARNING,
        recordsProcessed,
        completedAt: new Date(),
        message: error instanceof Error ? error.message : 'Comparable sync failed.',
      },
    });
    throw error;
  }
}
