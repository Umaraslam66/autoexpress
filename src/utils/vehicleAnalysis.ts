import type {
  ComparableListing,
  MatchConfidence,
  PricingDecision,
  PricingFileRecord,
  Vehicle,
} from '../types.js';
import { getFreshnessStatus, computePricing } from './pricing.js';

export interface VehicleInsight {
  vehicle: Vehicle;
  pricing: ReturnType<typeof computePricing>;
  decision?: PricingDecision;
  pricingFiles: PricingFileRecord[];
  latestComparableAt: string | null;
  freshness: 'today' | 'yesterday' | 'stale';
  bestConfidence: MatchConfidence;
  needsReview: boolean;
  finalTarget: number;
  attentionScore: number;
}

function sortConfidence(a: MatchConfidence, b: MatchConfidence): MatchConfidence {
  const order: MatchConfidence[] = ['high', 'medium', 'low'];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

export function buildVehicleInsights(
  vehicles: Vehicle[],
  comparables: ComparableListing[],
  decisions: Record<string, PricingDecision>,
  excludedComparables: Record<string, string[]>,
  pricingFiles: PricingFileRecord[],
): VehicleInsight[] {
  return vehicles.map((vehicle) => {
    const vehicleComparables = comparables.filter((listing) => listing.vehicleId === vehicle.id);
    const decision = decisions[vehicle.id];
    const excluded = excludedComparables[vehicle.id] ?? [];
    const pricing = computePricing(vehicle, vehicleComparables, excluded, decision);
    const latestComparableAt = vehicleComparables.reduce<string | null>((latest, listing) => {
      if (!latest || new Date(listing.lastSeenAt).getTime() > new Date(latest).getTime()) {
        return listing.lastSeenAt;
      }
      return latest;
    }, null);

    const bestConfidence = vehicleComparables.reduce<MatchConfidence>((best, listing) => {
      return sortConfidence(best, listing.confidence);
    }, 'low');

    const freshness = getFreshnessStatus(latestComparableAt ?? vehicle.dateAdded);
    const positionPenalty =
      pricing.currentPosition === 'above_market'
        ? 35
        : pricing.currentPosition === 'below_market'
          ? 10
          : 0;
    const freshnessPenalty = freshness === 'stale' ? 30 : freshness === 'yesterday' ? 15 : 0;
    const comparablePenalty = pricing.comparableCount < 3 ? 20 : pricing.comparableCount < 5 ? 8 : 0;
    const decisionPenalty = decision ? 0 : 12;
    const attentionScore = positionPenalty + freshnessPenalty + comparablePenalty + decisionPenalty;
    const needsReview = attentionScore >= 20 || !decision;

    return {
      vehicle,
      pricing,
      decision,
      pricingFiles: pricingFiles.filter((record) => record.vehicleId === vehicle.id),
      latestComparableAt,
      freshness,
      bestConfidence,
      needsReview,
      finalTarget: decision?.targetPrice ?? pricing.suggestedTarget ?? vehicle.price,
      attentionScore,
    };
  });
}
