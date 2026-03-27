import type { ComparableListing, MatchConfidence, Vehicle } from '../../src/types.js';
import { normalizeComparable, normalizeVehicle } from '../../src/utils/normalization.js';

interface MatchResult {
  score: number;
  confidence: MatchConfidence;
  explanation: string[];
}

export function scoreComparable(vehicle: Vehicle, comparable: ComparableListing): MatchResult {
  const normalizedVehicle = normalizeVehicle(vehicle);
  const normalizedComparable = normalizeComparable(comparable);
  let score = 0;
  const explanation: string[] = [];

  if (normalizedVehicle.normalizedSpec?.normalizedMake.toLowerCase() === normalizedComparable.normalizedSpec?.normalizedMake.toLowerCase()) {
    score += 28;
    explanation.push('Make exact match');
  }

  if (normalizedVehicle.normalizedSpec?.normalizedModel.toLowerCase() === normalizedComparable.normalizedSpec?.normalizedModel.toLowerCase()) {
    score += 28;
    explanation.push('Model exact match');
  }

  const yearDiff = Math.abs(vehicle.year - comparable.year);
  score += Math.max(0, 16 - yearDiff * 5);
  if (yearDiff <= 1) {
    explanation.push(`Year within ${yearDiff} year`);
  }

  const mileageDiff = Math.abs(vehicle.mileageKm - comparable.mileageKm);
  if (mileageDiff <= 15000) {
    score += 12;
    explanation.push('Mileage within 15,000 km');
  } else if (mileageDiff <= 40000) {
    score += 6;
  }

  if (comparable.fuel !== 'Unknown' && vehicle.fuel.toLowerCase() === comparable.fuel.toLowerCase()) {
    score += 8;
    explanation.push('Fuel exact match');
  }

  if (
    comparable.transmission !== 'Unknown' &&
    vehicle.transmission.toLowerCase() === comparable.transmission.toLowerCase()
  ) {
    score += 6;
    explanation.push('Transmission exact match');
  }

  if (comparable.bodyType !== 'Unknown' && vehicle.bodyType.toLowerCase() === comparable.bodyType.toLowerCase()) {
    score += 4;
    explanation.push('Body type exact match');
  }

  const sharedTokens = (normalizedVehicle.normalizedSpec?.searchTokens ?? []).filter((token) =>
    (normalizedComparable.normalizedSpec?.searchTokens ?? []).includes(token),
  );
  if (sharedTokens.length) {
    score += Math.min(8, sharedTokens.length * 2);
    explanation.push('Trim keyword overlap');
  }

  const priceDeltaRatio = vehicle.price > 0 ? Math.abs(vehicle.price - comparable.price) / vehicle.price : 0;
  if (priceDeltaRatio <= 0.12) {
    score += 6;
    explanation.push('Price band aligned');
  } else if (priceDeltaRatio <= 0.2) {
    score += 3;
  }

  let confidence: MatchConfidence = 'low';
  if (score >= 72) {
    confidence = 'high';
  } else if (score >= 52) {
    confidence = 'medium';
  }

  return {
    score,
    confidence,
    explanation,
  };
}
