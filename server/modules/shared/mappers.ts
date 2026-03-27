import {
  InventorySourceMode,
  JobStatus,
  MatchConfidence,
  SourceHealthStatus,
  SourceName,
  UserRole,
  VehicleStatus,
  type InventorySource,
  type JobRun,
  type NormalizationRule,
  type PricingDecision,
  type PricingFile,
  type PricingRecommendation,
  type User,
  type Vehicle,
  type VehicleSnapshot,
  type VehicleMatch,
  type NormalizedListing,
} from '@prisma/client';
import type {
  AppUser,
  ComparableListing,
  JobRun as JobRunDto,
  NormalizationRule as NormalizationRuleDto,
  PricingComputation,
  PricingDecision as PricingDecisionDto,
  PricingFileRecord,
  SourceHealth,
  SourceName as SourceNameDto,
  Vehicle as VehicleDto,
} from '../../../src/types.js';
import { buildNormalizedVehicleSpec } from '../../../src/utils/normalization.js';

function mapRole(role: UserRole): AppUser['role'] {
  return role === UserRole.ADMIN ? 'admin' : 'pricing_manager';
}

export function mapSourceName(source: SourceName): SourceNameDto {
  switch (source) {
    case SourceName.AUTOXPRESS:
      return 'autoxpress';
    case SourceName.CARZONE:
      return 'carzone';
    case SourceName.CARSIRELAND:
      return 'carsireland';
    case SourceName.DONEDEAL:
      return 'donedeal';
    default:
      return 'autoxpress';
  }
}

function mapVehicleStatus(status: VehicleStatus): VehicleDto['status'] {
  switch (status) {
    case VehicleStatus.ACTIVE:
      return 'active';
    case VehicleStatus.SOLD:
      return 'sold';
    case VehicleStatus.INCOMING:
      return 'incoming';
    default:
      return 'active';
  }
}

function mapConfidence(confidence: MatchConfidence): ComparableListing['confidence'] {
  switch (confidence) {
    case MatchConfidence.HIGH:
      return 'high';
    case MatchConfidence.MEDIUM:
      return 'medium';
    case MatchConfidence.LOW:
      return 'low';
    default:
      return 'low';
  }
}

function mapJobStatus(status: JobStatus): JobRunDto['status'] {
  switch (status) {
    case JobStatus.SUCCESS:
      return 'success';
    case JobStatus.WARNING:
      return 'warning';
    case JobStatus.FAILED:
      return 'failed';
    default:
      return 'warning';
  }
}

function mapHealthStatus(status: SourceHealthStatus): SourceHealth['status'] {
  switch (status) {
    case SourceHealthStatus.HEALTHY:
      return 'healthy';
    case SourceHealthStatus.DEGRADED:
      return 'degraded';
    case SourceHealthStatus.OFFLINE:
      return 'offline';
    default:
      return 'offline';
  }
}

function mapFreshness(value: Date | null): SourceHealth['freshness'] {
  if (!value) {
    return 'stale';
  }

  const ageMs = Date.now() - value.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  if (ageMs < dayMs) {
    return 'today';
  }
  if (ageMs < dayMs * 2) {
    return 'yesterday';
  }
  return 'stale';
}

export function toAppUser(user: User): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: mapRole(user.role),
  };
}

export function toVehicleDto(vehicle: Vehicle & { snapshots?: VehicleSnapshot[] }): VehicleDto {
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
    status: mapVehicleStatus(vehicle.status),
    dateAdded: vehicle.dateAdded.toISOString(),
    location: vehicle.location,
    vehicleUrl: vehicle.vehicleUrl,
    imageUrl: vehicle.imageUrl,
    normalizedSpec:
      (vehicle.normalizedSpecJson as VehicleDto['normalizedSpec'] | null) ??
      buildNormalizedVehicleSpec({
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        fuel: vehicle.fuel,
        transmission: vehicle.transmission,
        engineLitres: vehicle.engineLitres,
        year: vehicle.year,
      }),
    stockClockStartAt: vehicle.stockClockStartAt?.toISOString(),
    lastPriceChangeAt: vehicle.lastPriceChangeAt?.toISOString(),
    notes: Array.isArray(vehicle.notesJson) ? vehicle.notesJson.filter((item): item is string => typeof item === 'string') : [],
    priceHistory: (vehicle.snapshots ?? [])
      .slice()
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
      .map((snapshot) => ({
        changedAt: snapshot.capturedAt.toISOString(),
        price: snapshot.price,
        changedBy: 'System sync',
      })),
  };
}

export function toComparableListingDto(
  vehicleMatch: VehicleMatch & { normalizedListing: NormalizedListing },
): ComparableListing {
  const listing = vehicleMatch.normalizedListing;
  const explanation = Array.isArray(vehicleMatch.explanationJson)
    ? vehicleMatch.explanationJson.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    id: listing.id,
    vehicleId: vehicleMatch.vehicleId,
    source: mapSourceName(listing.source),
    listingId: listing.externalId,
    listingUrl: listing.listingUrl,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    variant: listing.variant,
    year: listing.year,
    mileageKm: listing.mileageKm,
    fuel: listing.fuel,
    transmission: listing.transmission,
    bodyType: listing.bodyType,
    engineLitres: listing.engineLitres ?? undefined,
    price: listing.price,
    dealerName: listing.dealerName,
    dealerLocation: listing.dealerLocation,
    listedAt: listing.listedAt?.toISOString() ?? listing.lastSeenAt.toISOString(),
    daysListed: listing.daysListed,
    imageUrl: listing.imageUrl ?? undefined,
    normalizedSpec:
      (listing.normalizedSpecJson as ComparableListing['normalizedSpec'] | null) ??
      buildNormalizedVehicleSpec({
        make: listing.make,
        model: listing.model,
        variant: listing.variant,
        title: listing.title,
        fuel: listing.fuel,
        transmission: listing.transmission,
        engineLitres: listing.engineLitres ?? undefined,
        year: listing.year,
      }),
    lastSeenAt: listing.lastSeenAt.toISOString(),
    matchScore: vehicleMatch.score,
    confidence: mapConfidence(vehicleMatch.confidence),
    explanation,
  };
}

export function toPricingDecisionDto(
  decision: PricingDecision & { user: User },
): PricingDecisionDto {
  return {
    vehicleId: decision.vehicleId,
    targetPrice: decision.targetPrice,
    note: decision.note,
    decidedBy: decision.user.name,
    decidedAt: decision.decidedAt.toISOString(),
    type: decision.type === 'ACCEPTED' ? 'accepted' : 'manual',
  };
}

export function toPricingFileDto(
  file: PricingFile & { user: User },
): PricingFileRecord {
  return {
    id: file.id,
    vehicleId: file.vehicleId,
    createdAt: file.createdAt.toISOString(),
    createdBy: file.user.name,
    recommendationTarget: file.recommendationTarget,
    finalTarget: file.finalTarget,
    note: file.note,
    comparableCount: file.comparableCount,
  };
}

export function toJobRunDto(jobRun: JobRun): JobRunDto {
  return {
    id: jobRun.id,
    source: mapSourceName(jobRun.source),
    status: mapJobStatus(jobRun.status),
    startedAt: jobRun.startedAt.toISOString(),
    completedAt: (jobRun.completedAt ?? jobRun.startedAt).toISOString(),
    recordsProcessed: jobRun.recordsProcessed,
    message: jobRun.message,
  };
}

export function toNormalizationRuleDto(rule: NormalizationRule): NormalizationRuleDto {
  return {
    id: rule.id,
    dictionary: rule.dictionary,
    sourceValue: rule.sourceValue,
    canonicalValue: rule.canonicalValue,
  };
}

export function toSourceHealth(
  inventorySource: InventorySource,
  latestJobRun: JobRun | null,
): SourceHealth {
  const lastSuccessAt = latestJobRun?.completedAt ?? inventorySource.lastSuccessAt ?? inventorySource.lastRunAt ?? new Date(0);
  const status = latestJobRun?.healthStatus ?? SourceHealthStatus.OFFLINE;

  return {
    source: mapSourceName(inventorySource.source),
    cadence:
      inventorySource.source === SourceName.AUTOXPRESS
        ? inventorySource.mode === InventorySourceMode.FEED
          ? 'Every 4 hours via feed'
          : inventorySource.mode === InventorySourceMode.SCRAPE
            ? 'Every 4 hours via website scrape'
            : 'On demand CSV import'
        : inventorySource.source === SourceName.DONEDEAL
          ? 'Feature-flagged browser automation'
          : 'Every 12 hours via browser automation',
    lastSuccessAt: lastSuccessAt.toISOString(),
    freshness: mapFreshness(inventorySource.lastSuccessAt ?? latestJobRun?.completedAt ?? null),
    status: mapHealthStatus(status),
    message: latestJobRun?.message ?? `Waiting for ${inventorySource.mode.toLowerCase()} sync.`,
  };
}

export function toPricingComputation(
  recommendation: PricingRecommendation | null,
  includedComparables: ComparableListing[],
  excludedLowConfidence: ComparableListing[],
  filteredOutliers: ComparableListing[],
): PricingComputation {
  const reasoning = recommendation && Array.isArray(recommendation.reasoningJson)
    ? recommendation.reasoningJson.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    comparableCount: recommendation?.comparableCount ?? includedComparables.length,
    includedComparables,
    excludedLowConfidence,
    filteredOutliers,
    marketMin: recommendation?.marketMin ?? null,
    marketMax: recommendation?.marketMax ?? null,
    marketMedian: recommendation?.marketMedian ?? null,
    marketAverage: recommendation?.marketAverage ?? null,
    similarMileageMedian: recommendation?.similarMileageMedian ?? null,
    similarYearMedian: recommendation?.similarYearMedian ?? null,
    suggestedFloor: recommendation?.suggestedFloor ?? null,
    suggestedTarget: recommendation?.suggestedTarget ?? null,
    suggestedCeiling: recommendation?.suggestedCeiling ?? null,
    currentPosition:
      recommendation?.currentPosition === 'below_market' ||
      recommendation?.currentPosition === 'in_market' ||
      recommendation?.currentPosition === 'above_market'
        ? recommendation.currentPosition
        : null,
    deltaToTargetPct: recommendation?.deltaToTargetPct ?? null,
    reasoning,
  };
}
