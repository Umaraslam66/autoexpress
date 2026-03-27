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
  const vehicleSpec = normalizedVehicle.normalizedSpec;
  const comparableSpec = normalizedComparable.normalizedSpec;
  let score = 0;
  const explanation: string[] = [];

  if (vehicleSpec?.normalizedMake.toLowerCase() === comparableSpec?.normalizedMake.toLowerCase()) {
    score += 28;
    explanation.push('Make exact match');
  }

  if (vehicleSpec?.normalizedModel.toLowerCase() === comparableSpec?.normalizedModel.toLowerCase()) {
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

  if (
    vehicleSpec?.fuelType &&
    comparableSpec?.fuelType &&
    vehicleSpec.fuelType !== 'Unknown' &&
    vehicleSpec.fuelType === comparableSpec.fuelType
  ) {
    score += 8;
    explanation.push('Fuel normalized match');
  }

  if (
    vehicleSpec?.transmission &&
    comparableSpec?.transmission &&
    vehicleSpec.transmission !== 'Unknown' &&
    vehicleSpec.transmission === comparableSpec.transmission
  ) {
    score += 6;
    explanation.push('Transmission normalized match');
  }

  if (comparable.bodyType !== 'Unknown' && vehicle.bodyType.toLowerCase() === comparable.bodyType.toLowerCase()) {
    score += 4;
    explanation.push('Body type exact match');
  }

  if (
    vehicleSpec?.trim &&
    comparableSpec?.trim &&
    vehicleSpec.trim.toLowerCase() === comparableSpec.trim.toLowerCase()
  ) {
    score += 6;
    explanation.push('Trim exact match');
  }

  if (
    vehicleSpec?.derivative &&
    comparableSpec?.derivative &&
    vehicleSpec.derivative.toLowerCase() === comparableSpec.derivative.toLowerCase()
  ) {
    score += 8;
    explanation.push('Derivative exact match');
  }

  const sharedTokens = (vehicleSpec?.searchTokens ?? []).filter((token) =>
    (comparableSpec?.searchTokens ?? []).includes(token),
  );
  if (sharedTokens.length) {
    score += Math.min(8, sharedTokens.length * 2);
    explanation.push('Normalized keyword overlap');
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
