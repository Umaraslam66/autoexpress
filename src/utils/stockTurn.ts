import type { Vehicle } from '../types.js';
import { daysBetween } from './format.js';

export type StockTurnAction = 'reduce' | 'monitor';

export function getDaysInStock(vehicle: Vehicle): number {
  return daysBetween(vehicle.stockClockStartAt ?? vehicle.dateAdded);
}

export function getDaysSincePriceChange(vehicle: Vehicle): number {
  const lastChange =
    vehicle.lastPriceChangeAt ??
    vehicle.priceHistory
      .slice()
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())[0]?.changedAt ??
    vehicle.dateAdded;

  return daysBetween(lastChange);
}

export function getStockTurnAction(input: {
  currentPosition: 'below_market' | 'in_market' | 'above_market' | null;
  daysInStock: number;
  daysSincePriceChange: number;
}): StockTurnAction {
  if (
    input.currentPosition === 'above_market' &&
    (input.daysInStock >= 45 || input.daysSincePriceChange >= 21)
  ) {
    return 'reduce';
  }

  return 'monitor';
}
