import { PriceDecisionType, type Prisma } from '@prisma/client';
import { computePricing } from '../../../src/utils/pricing.js';
import type {
  ComparableExclusionInput,
  PricingDecisionCreateInput,
} from '../../../src/types.js';
import { prisma } from '../../lib/prisma.js';
import { HttpError } from '../../lib/http.js';
import { toComparableListingDto, toPricingDecisionDto, toPricingFileDto, toPricingComputation, toVehicleDto } from '../shared/mappers.js';

async function loadVehicleContext(tx: Prisma.TransactionClient | typeof prisma, dealershipId: string, vehicleId: string) {
  const vehicle = await tx.vehicle.findFirst({
    where: { id: vehicleId, dealershipId },
  });

  if (!vehicle) {
    throw new HttpError(404, 'Vehicle not found.');
  }

  const matches = await tx.vehicleMatch.findMany({
    where: { vehicleId, dealershipId },
    include: { normalizedListing: true },
    orderBy: { score: 'desc' },
  });

  const exclusions = await tx.excludedComparable.findMany({
    where: { dealershipId, vehicleId },
  });

  return {
    vehicle,
    matches,
    excludedIds: exclusions.map((entry) => entry.normalizedListingId),
  };
}

export async function recomputeVehiclePricing(
  dealershipId: string,
  vehicleId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const context = await loadVehicleContext(tx, dealershipId, vehicleId);
  const vehicleDto = toVehicleDto(context.vehicle);
  const listings = context.matches.map(toComparableListingDto);
  const pricing = computePricing(vehicleDto, listings, context.excludedIds);

  return tx.pricingRecommendation.create({
    data: {
      dealershipId,
      vehicleId,
      comparableCount: pricing.comparableCount,
      marketMin: pricing.marketMin,
      marketMax: pricing.marketMax,
      marketMedian: pricing.marketMedian ? Math.round(pricing.marketMedian) : null,
      marketAverage: pricing.marketAverage ? Math.round(pricing.marketAverage) : null,
      similarMileageMedian: pricing.similarMileageMedian ? Math.round(pricing.similarMileageMedian) : null,
      similarYearMedian: pricing.similarYearMedian ? Math.round(pricing.similarYearMedian) : null,
      suggestedFloor: pricing.suggestedFloor,
      suggestedTarget: pricing.suggestedTarget,
      suggestedCeiling: pricing.suggestedCeiling,
      currentPosition: pricing.currentPosition,
      deltaToTargetPct: pricing.deltaToTargetPct,
      reasoningJson: pricing.reasoning,
    },
  });
}

export async function recomputeDealershipPricing(dealershipId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: { dealershipId, status: 'ACTIVE' },
    select: { id: true },
  });

  for (const vehicle of vehicles) {
    await recomputeVehiclePricing(dealershipId, vehicle.id);
  }
}

export async function createPricingDecision(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  input: PricingDecisionCreateInput,
) {
  const decision = await prisma.pricingDecision.create({
    data: {
      dealershipId,
      userId,
      vehicleId,
      targetPrice: input.targetPrice,
      note: input.note,
      type: input.type === 'accepted' ? PriceDecisionType.ACCEPTED : PriceDecisionType.MANUAL,
    },
    include: {
      user: true,
    },
  });

  return toPricingDecisionDto(decision);
}

export async function toggleComparableExclusion(
  dealershipId: string,
  userId: string,
  vehicleId: string,
  input: ComparableExclusionInput,
) {
  if (input.excluded) {
    await prisma.excludedComparable.upsert({
      where: {
        vehicleId_normalizedListingId: {
          vehicleId,
          normalizedListingId: input.comparableId,
        },
      },
      update: {
        userId,
      },
      create: {
        dealershipId,
        userId,
        vehicleId,
        normalizedListingId: input.comparableId,
      },
    });

    await prisma.vehicleMatch.updateMany({
      where: {
        vehicleId,
        normalizedListingId: input.comparableId,
      },
      data: {
        included: false,
        manuallyExcluded: true,
      },
    });
  } else {
    await prisma.excludedComparable.deleteMany({
      where: {
        dealershipId,
        vehicleId,
        normalizedListingId: input.comparableId,
      },
    });

    await prisma.vehicleMatch.updateMany({
      where: {
        vehicleId,
        normalizedListingId: input.comparableId,
      },
      data: {
        included: true,
        manuallyExcluded: false,
      },
    });
  }

  await recomputeVehiclePricing(dealershipId, vehicleId);
}

export async function createPricingFile(
  dealershipId: string,
  userId: string,
  vehicleId: string,
) {
  return prisma.$transaction(async (tx) => {
    const { vehicle, matches, excludedIds } = await loadVehicleContext(tx, dealershipId, vehicleId);
    const latestDecision = await tx.pricingDecision.findFirst({
      where: { dealershipId, vehicleId },
      include: { user: true },
      orderBy: { decidedAt: 'desc' },
    });

    const listings = matches.map(toComparableListingDto);
    const vehicleDto = toVehicleDto(vehicle);
    const pricing = computePricing(vehicleDto, listings, excludedIds, latestDecision ? toPricingDecisionDto(latestDecision) : undefined);

    const record = await tx.pricingFile.create({
      data: {
        dealershipId,
        userId,
        vehicleId,
        recommendationTarget: pricing.suggestedTarget ?? vehicle.price,
        finalTarget: latestDecision?.targetPrice ?? pricing.suggestedTarget ?? vehicle.price,
        note: latestDecision?.note ?? 'Generated from persisted pricing recommendation.',
        comparableCount: pricing.comparableCount,
      },
      include: { user: true },
    });

    return {
      record: toPricingFileDto(record),
      vehicle: vehicleDto,
      comparables: listings,
      decision: latestDecision ? toPricingDecisionDto(latestDecision) : null,
    };
  });
}

export function buildPricingComputation(
  recommendation: Awaited<ReturnType<typeof prisma.pricingRecommendation.findFirst>>,
  matches: Array<Parameters<typeof toComparableListingDto>[0]>,
) {
  const listings = matches.map(toComparableListingDto);
  const included = listings.filter((listing) => listing.confidence === 'high' || listing.confidence === 'medium');
  const lowConfidence = listings.filter((listing) => listing.confidence === 'low');
  return toPricingComputation(recommendation, included, lowConfidence, []);
}
