import type { ComparableListing, Vehicle } from '../types.js';

export interface NormalizedVehicleSpec {
  normalizedMake: string;
  normalizedModel: string;
  derivative: string;
  trim: string;
  engineBadge: string;
  fuelType: string;
  transmission: string;
  searchTokens: string[];
}

const TRIM_PATTERNS = [
  'comfortline',
  'highline',
  's line',
  's-line',
  'amg',
  'm sport',
  'msport',
  'life',
  'style',
  'executive plus',
  'executive',
  'sportback',
  'sport',
  'iconic',
  'luna sport',
  'luna',
  'se',
];

const ENGINE_PATTERNS = [
  'phev',
  'hev',
  'hybrid',
  'electric',
  'diesel',
  'petrol',
  'tdi',
  'tsi',
  'tfsi',
  'etsi',
  'tce',
  'dci',
  '320d',
  '330e',
];

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/volkswagen|vw/g, 'volkswagen')
    .replace(/s[\s-]?line/g, 's line')
    .replace(/m[\s-]?sport/g, 'm sport')
    .replace(/(\d\.\d)\s*d\b/g, '$1 diesel')
    .replace(/[^\w.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(...parts: Array<string | number | undefined>): string[] {
  return Array.from(
    new Set(
      parts
        .flatMap((part) => normalizeText(String(part ?? '')).split(/\s+/))
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  );
}

function extractTrim(text: string): string {
  const found = TRIM_PATTERNS.find((pattern) => text.includes(pattern));
  return found ? titleCase(found.replace(/-/g, ' ')) : '';
}

function extractEngineBadge(text: string, engineLitres?: number): string {
  const found = ENGINE_PATTERNS.find((pattern) => text.includes(pattern));
  if (found) {
    switch (found) {
      case 'hybrid':
      case 'electric':
      case 'diesel':
      case 'petrol':
        return titleCase(found);
      case 'phev':
        return 'PHEV';
      case 'hev':
        return 'HEV';
      default:
        return found.toUpperCase();
    }
  }
  const litresMatch = text.match(/\b\d\.\d\b/);
  if (litresMatch) {
    return litresMatch[0];
  }
  return engineLitres ? `${engineLitres.toFixed(1)}L` : '';
}

function extractEngineCapacity(text: string, engineLitres?: number): string {
  const litresMatch = text.match(/\b\d\.\d\b/);
  if (litresMatch) {
    return litresMatch[0];
  }
  return engineLitres ? engineLitres.toFixed(1) : '';
}

function canonicalFuel(text: string, fuel?: string): string {
  const candidate = normalizeText(`${text} ${fuel ?? ''}`);
  if (candidate.includes('hybrid') || candidate.includes('phev')) {
    return 'Hybrid';
  }
  if (candidate.includes('electric') || candidate.includes('ev')) {
    return 'Electric';
  }
  if (candidate.includes('diesel') || candidate.includes('tdi') || candidate.includes('dci')) {
    return 'Diesel';
  }
  if (candidate.includes('petrol') || candidate.includes('tsi') || candidate.includes('tfsi') || candidate.includes('tce')) {
    return 'Petrol';
  }
  return fuel ?? 'Unknown';
}

function canonicalTransmission(text: string, transmission?: string): string {
  const candidate = normalizeText(`${text} ${transmission ?? ''}`);
  if (candidate.includes('automatic') || candidate.includes('auto') || candidate.includes('dsg') || candidate.includes('s tronic')) {
    return 'Automatic';
  }
  if (candidate.includes('manual')) {
    return 'Manual';
  }
  return transmission ?? 'Unknown';
}

function buildDerivative(text: string, engineLitres?: number, fuel?: string): string {
  const capacity = extractEngineCapacity(text, engineLitres);
  const badge = extractEngineBadge(text, engineLitres);
  const normalizedFuel = canonicalFuel(text, fuel);
  const normalizedBadge =
    badge && badge !== capacity
      ? badge
      : normalizedFuel !== 'Unknown'
        ? normalizedFuel
        : '';

  if (capacity && normalizedBadge) {
    return `${capacity} ${normalizedBadge}`;
  }
  if (normalizedBadge) {
    return normalizedBadge;
  }
  if (capacity) {
    return capacity;
  }
  return '';
}

function mergeSearchTokens(...tokenGroups: string[][]): string[] {
  return Array.from(
    new Set(
      tokenGroups
        .flat()
        .flatMap((token) => tokenize(token))
        .filter(Boolean),
    ),
  );
}

export function buildNormalizedVehicleSpec(input: {
  make: string;
  model: string;
  variant?: string;
  title?: string;
  fuel?: string;
  transmission?: string;
  engineLitres?: number;
  year?: number;
}): NormalizedVehicleSpec {
  const combined = normalizeText(
    `${input.make} ${input.model} ${input.variant ?? ''} ${input.title ?? ''} ${input.fuel ?? ''} ${input.transmission ?? ''}`,
  );
  const derivative = buildDerivative(combined, input.engineLitres, input.fuel);
  const engineBadge = extractEngineBadge(combined, input.engineLitres);
  const trim = extractTrim(combined);
  const fuelType = canonicalFuel(combined, input.fuel);
  const normalizedTransmission = canonicalTransmission(combined, input.transmission);

  const searchTokens = tokenize(
    input.make,
    input.model,
    input.variant,
    input.title,
    input.fuel,
    input.transmission,
    input.year,
    trim,
    engineBadge,
    derivative,
    fuelType,
    normalizedTransmission,
  );

  return {
    normalizedMake: titleCase(normalizeText(input.make)),
    normalizedModel: titleCase(normalizeText(input.model)),
    derivative,
    trim,
    engineBadge,
    fuelType,
    transmission: normalizedTransmission,
    searchTokens,
  };
}

export function hydrateNormalizedVehicleSpec(
  existing: Partial<NormalizedVehicleSpec> | null | undefined,
  input: Parameters<typeof buildNormalizedVehicleSpec>[0],
): NormalizedVehicleSpec {
  const built = buildNormalizedVehicleSpec(input);

  if (!existing) {
    return built;
  }

  return {
    normalizedMake: existing.normalizedMake || built.normalizedMake,
    normalizedModel: existing.normalizedModel || built.normalizedModel,
    derivative: existing.derivative || built.derivative,
    trim: existing.trim || built.trim,
    engineBadge: existing.engineBadge || built.engineBadge,
    fuelType: existing.fuelType || built.fuelType,
    transmission: existing.transmission || built.transmission,
    searchTokens: mergeSearchTokens(existing.searchTokens ?? [], built.searchTokens),
  };
}

export function normalizeVehicle(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    normalizedSpec:
      hydrateNormalizedVehicleSpec(vehicle.normalizedSpec, {
        make: vehicle.make,
        model: vehicle.model,
        variant: vehicle.variant,
        fuel: vehicle.fuel,
        transmission: vehicle.transmission,
        engineLitres: vehicle.engineLitres,
        year: vehicle.year,
      }),
  };
}

export function normalizeComparable(listing: ComparableListing): ComparableListing {
  return {
    ...listing,
    normalizedSpec:
      hydrateNormalizedVehicleSpec(listing.normalizedSpec, {
        make: listing.make,
        model: listing.model,
        variant: listing.variant,
        title: listing.title,
        fuel: listing.fuel,
        transmission: listing.transmission,
        engineLitres: listing.engineLitres,
        year: listing.year,
      }),
  };
}

export function matchesSearchTokens(tokens: string[], query: string): boolean {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    return true;
  }
  return queryTokens.every((queryToken) => tokens.some((token) => token.includes(queryToken)));
}
