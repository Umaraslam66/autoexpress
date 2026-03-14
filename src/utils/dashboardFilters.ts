import type { VehicleInsight } from './vehicleAnalysis.js';
import { median } from './format.js';

export type DashboardVehicleFilter =
  | 'all'
  | 'market_aligned'
  | 'need_review'
  | 'above_market'
  | 'below_market';

export interface DashboardVehicleFilterConfig {
  label: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

export const DASHBOARD_VEHICLE_FILTERS: Record<DashboardVehicleFilter, DashboardVehicleFilterConfig> = {
  all: {
    label: 'In-stock vehicles',
    tone: 'default',
  },
  market_aligned: {
    label: 'Market aligned',
    tone: 'success',
  },
  need_review: {
    label: 'Need review',
    tone: 'warning',
  },
  above_market: {
    label: 'Above market risk',
    tone: 'danger',
  },
  below_market: {
    label: 'Below market',
    tone: 'success',
  },
};

export function isDashboardVehicleFilter(value: string | null): value is DashboardVehicleFilter {
  return value !== null && value in DASHBOARD_VEHICLE_FILTERS;
}

export type DashboardRiskBand = 'green' | 'amber' | 'red';

function getMarketReferencePrice(insight: VehicleInsight): number | null {
  return insight.pricing.suggestedTarget ?? insight.pricing.marketMedian ?? insight.finalTarget ?? null;
}

function getComparableMileageDelta(insight: VehicleInsight): number | null {
  const comparableMileage = median(insight.pricing.includedComparables.map((listing) => listing.mileageKm));

  if (comparableMileage === null) {
    return null;
  }

  return Math.abs(insight.vehicle.mileageKm - comparableMileage);
}

export function getDashboardRiskBand(insight: VehicleInsight): DashboardRiskBand {
  const referencePrice = getMarketReferencePrice(insight);
  const comparableMileageDelta = getComparableMileageDelta(insight);

  if (referencePrice === null || comparableMileageDelta === null) {
    return 'amber';
  }

  const priceDelta = Math.max(0, insight.vehicle.price - referencePrice);
  const priceSeverity = priceDelta <= 300 ? 0 : priceDelta <= 800 ? 1 : 2;
  const mileageSeverity = comparableMileageDelta <= 10000 ? 0 : comparableMileageDelta <= 20000 ? 1 : 2;
  const severity = Math.max(priceSeverity, mileageSeverity);

  return severity === 0 ? 'green' : severity === 1 ? 'amber' : 'red';
}

export function matchesDashboardVehicleFilter(insight: VehicleInsight, filter: DashboardVehicleFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'market_aligned':
      return getDashboardRiskBand(insight) === 'green';
    case 'need_review':
      return getDashboardRiskBand(insight) === 'amber';
    case 'above_market':
      return getDashboardRiskBand(insight) === 'red';
    case 'below_market':
      return insight.pricing.currentPosition === 'below_market';
    default:
      return true;
  }
}
