export type UserRole = 'admin' | 'pricing_manager';
export type SourceName = 'autoxpress' | 'carzone' | 'carsireland';
export type MatchConfidence = 'high' | 'medium' | 'low';
export type PricePosition = 'below_market' | 'in_market' | 'above_market';
export type FreshnessStatus = 'today' | 'yesterday' | 'stale';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Vehicle {
  id: string;
  stockId: string;
  registration: string;
  vinFragment?: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  mileageKm: number;
  fuel: string;
  transmission: string;
  bodyType: string;
  engineLitres: number;
  colour: string;
  price: number;
  status: 'active' | 'sold' | 'incoming';
  dateAdded: string;
  location: string;
  vehicleUrl: string;
  imageUrl: string;
  notes: string[];
  priceHistory: PriceHistoryEntry[];
}

export interface PriceHistoryEntry {
  changedAt: string;
  price: number;
  changedBy: string;
}

export interface ComparableListing {
  id: string;
  vehicleId: string;
  source: SourceName;
  listingId: string;
  listingUrl: string;
  title: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  mileageKm: number;
  fuel: string;
  transmission: string;
  bodyType: string;
  engineLitres?: number;
  price: number;
  dealerName: string;
  dealerLocation: string;
  listedAt: string;
  daysListed: number;
  imageUrl?: string;
  lastSeenAt: string;
  matchScore: number;
  confidence: MatchConfidence;
  explanation: string[];
}

export interface PricingDecision {
  vehicleId: string;
  targetPrice: number;
  note: string;
  decidedBy: string;
  decidedAt: string;
  type: 'accepted' | 'manual';
}

export interface PricingFileRecord {
  id: string;
  vehicleId: string;
  createdAt: string;
  createdBy: string;
  recommendationTarget: number;
  finalTarget: number;
  note: string;
  comparableCount: number;
}

export interface JobRun {
  id: string;
  source: SourceName;
  status: 'success' | 'warning' | 'failed';
  startedAt: string;
  completedAt: string;
  recordsProcessed: number;
  message: string;
}

export interface SourceHealth {
  source: SourceName;
  cadence: string;
  lastSuccessAt: string;
  freshness: FreshnessStatus;
  status: 'healthy' | 'degraded' | 'offline';
  message: string;
}

export interface NormalizationRule {
  id: string;
  dictionary: string;
  sourceValue: string;
  canonicalValue: string;
}

export interface PricingComputation {
  comparableCount: number;
  includedComparables: ComparableListing[];
  excludedLowConfidence: ComparableListing[];
  filteredOutliers: ComparableListing[];
  marketMin: number | null;
  marketMax: number | null;
  marketMedian: number | null;
  marketAverage: number | null;
  similarMileageMedian: number | null;
  similarYearMedian: number | null;
  suggestedFloor: number | null;
  suggestedTarget: number | null;
  suggestedCeiling: number | null;
  currentPosition: PricePosition | null;
  deltaToTargetPct: number | null;
  reasoning: string[];
}

export interface VehicleFilterState {
  query: string;
  make: string;
  fuel: string;
  transmission: string;
  bodyType: string;
  priceBand: string;
  freshness: string;
  confidence: string;
}

export interface BootstrapMeta {
  generatedAt: string;
  mode: 'live' | 'seed';
  messages: string[];
}

export interface DashboardSummary {
  totalVehicles: number;
  sufficientComparables: number;
  needingReview: number;
  aboveMarket: number;
  belowMarket: number;
  averageDaysInStock: number;
}

export interface VehicleDetailResponse {
  vehicle: Vehicle;
  comparables: ComparableListing[];
  pricing: PricingComputation;
  decision: PricingDecision | null;
  excludedComparableIds: string[];
  latestPricingFile: PricingFileRecord | null;
}

export interface PricingDecisionCreateInput {
  targetPrice: number;
  note: string;
  type: 'accepted' | 'manual';
}

export interface ComparableExclusionInput {
  comparableId: string;
  excluded: boolean;
}

export interface PricingFileResponse {
  record: PricingFileRecord;
  vehicle: Vehicle;
  comparables: ComparableListing[];
  decision: PricingDecision | null;
}

export interface SourceJobStatus {
  source: SourceName;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  latestStatus: 'healthy' | 'degraded' | 'offline';
  recordsProcessed: number;
  message: string;
}

export interface AdminImportStatus {
  source: SourceName | 'autoxpress-feed';
  mode: 'feed' | 'scrape' | 'csv';
  enabled: boolean;
  configured: boolean;
  lastRunAt: string | null;
  notes: string[];
}

export interface ApiBootstrapData {
  users: AppUser[];
  vehicles: Vehicle[];
  comparableListings: ComparableListing[];
  sourceHealth: SourceHealth[];
  jobRuns: JobRun[];
  normalizationRules: NormalizationRule[];
  pricingDecisions: Record<string, PricingDecision>;
  excludedComparables: Record<string, string[]>;
  pricingFiles: PricingFileRecord[];
  currentUser: AppUser | null;
  dashboard: DashboardSummary;
  meta: BootstrapMeta;
}
