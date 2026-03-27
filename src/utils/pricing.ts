import type {
  ComparableListing,
  FreshnessStatus,
  MatchConfidence,
  PricePosition,
  PricingComputation,
  PricingDecision,
  Vehicle,
} from '../types.js';
import { average, clamp, daysBetween, median } from './format.js';

function confidenceWeight(confidence: MatchConfidence): number {
  switch (confidence) {
    case 'high':
      return 1;
    case 'medium':
      return 0.65;
    case 'low':
      return 0.25;
    default:
      return 0;
  }
}

function adjustedComparablePrice(vehicle: Vehicle, comparable: ComparableListing): number {
  const mileageAdjustment = ((comparable.mileageKm - vehicle.mileageKm) / 1000) * 35;
  const yearAdjustment = (vehicle.year - comparable.year) * 420;
  const agePenalty = comparable.daysListed > 30 ? -120 : 0;

  return comparable.price + mileageAdjustment + yearAdjustment + agePenalty;
}

export function getFreshnessStatus(dateIso: string): FreshnessStatus {
  const age = daysBetween(dateIso);
  if (age <= 0) {
    return 'today';
  }
  if (age === 1) {
    return 'yesterday';
  }
  return 'stale';
}

export function computePricing(
  vehicle: Vehicle,
  listings: ComparableListing[],
  excludedComparableIds: string[],
  decision?: PricingDecision,
): PricingComputation {
  const lowConfidence = listings.filter((listing) => listing.confidence === 'low');
  const manuallyExcluded = new Set(excludedComparableIds);
  const eligible = listings.filter(
    (listing) =>
      !manuallyExcluded.has(listing.id) &&
      (listing.confidence === 'high' || listing.confidence === 'medium'),
  );

  const baseMedian = median(eligible.map((listing) => listing.price));
  const excludedByYear = eligible.filter((listing) => listing.year !== vehicle.year);

  const filtered = eligible.filter((listing) => {
    if (listing.year !== vehicle.year) {
      return false;
    }
    if (!baseMedian) {
      return true;
    }

    const priceDistance = Math.abs(listing.price - baseMedian) / baseMedian;
    const mileageDistance = Math.abs(listing.mileageKm - vehicle.mileageKm);
    return priceDistance <= 0.18 && mileageDistance <= 80000;
  });

  const filteredOutliers = eligible.filter((listing) => !filtered.includes(listing));
  const adjustedPrices = filtered.map((listing) => ({
    listing,
    adjustedPrice: adjustedComparablePrice(vehicle, listing),
    weight: confidenceWeight(listing.confidence),
  }));

  const weightedAdjusted = adjustedPrices.flatMap(({ adjustedPrice, weight }) =>
    Array.from({ length: Math.max(1, Math.round(weight * 10)) }, () => adjustedPrice),
  );

  const marketMin = filtered.length ? Math.min(...filtered.map((listing) => listing.price)) : null;
  const marketMax = filtered.length ? Math.max(...filtered.map((listing) => listing.price)) : null;
  const marketMedian = median(filtered.map((listing) => listing.price));
  const marketAverage = average(filtered.map((listing) => listing.price));
  const similarMileageMedian = median(
    filtered
      .filter((listing) => Math.abs(listing.mileageKm - vehicle.mileageKm) <= 15000)
      .map((listing) => listing.price),
  );
  const similarYearMedian = median(
    filtered.filter((listing) => Math.abs(listing.year - vehicle.year) <= 1).map((listing) => listing.price),
  );
  const suggestedTarget = median(weightedAdjusted);
  const suggestedFloor =
    suggestedTarget === null ? null : Math.round(clamp(suggestedTarget - 750, 0, Number.MAX_SAFE_INTEGER));
  const suggestedCeiling =
    suggestedTarget === null ? null : Math.round(clamp(suggestedTarget + 900, 0, Number.MAX_SAFE_INTEGER));

  let currentPosition: PricePosition | null = null;
  let deltaToTargetPct: number | null = null;

  if (suggestedTarget) {
    deltaToTargetPct = ((vehicle.price - suggestedTarget) / suggestedTarget) * 100;
    if (deltaToTargetPct < -3) {
      currentPosition = 'below_market';
    } else if (deltaToTargetPct > 3) {
      currentPosition = 'above_market';
    } else {
      currentPosition = 'in_market';
    }
  }

  const reasoning = [
    `Based on ${filtered.length} same-year market comparables after confidence filtering.`,
    marketMedian ? `Live market median is EUR ${Math.round(marketMedian).toLocaleString('en-IE')}.` : 'No median available yet.',
    similarMileageMedian
      ? `Similar-mileage median is EUR ${Math.round(similarMileageMedian).toLocaleString('en-IE')}.`
      : 'Mileage-specific subset is thin.',
    suggestedTarget
      ? `Adjusted target lands at EUR ${Math.round(suggestedTarget).toLocaleString('en-IE')}.`
      : 'Recommendation is blocked until more comparables arrive.',
  ];

  if (decision) {
    reasoning.push(`Manual decision stored at EUR ${Math.round(decision.targetPrice).toLocaleString('en-IE')}.`);
  }

  if (excludedByYear.length) {
    reasoning.push(`${excludedByYear.length} matched comparables were excluded because they are not the same year as this vehicle.`);
  }

  return {
    comparableCount: filtered.length,
    includedComparables: filtered,
    excludedLowConfidence: lowConfidence,
    filteredOutliers,
    marketMin,
    marketMax,
    marketMedian,
    marketAverage,
    similarMileageMedian,
    similarYearMedian,
    suggestedFloor,
    suggestedTarget: suggestedTarget ? Math.round(suggestedTarget) : null,
    suggestedCeiling,
    currentPosition,
    deltaToTargetPct,
    reasoning,
  };
}
