import { env } from '../../../config/env.js';
import type { Vehicle } from '../../../../src/types.js';
import type { InventorySyncResult } from './types.js';

function normalizeFeedVehicle(input: Record<string, unknown>, index: number): Vehicle {
  const externalId = String(input.stockId ?? input.id ?? index);
  return {
    id: `feed-${externalId}`,
    stockId: externalId,
    registration: String(input.registration ?? 'Unknown'),
    vinFragment: typeof input.vinFragment === 'string' ? input.vinFragment : '',
    make: String(input.make ?? 'Unknown'),
    model: String(input.model ?? 'Unknown'),
    variant: String(input.variant ?? input.trim ?? 'Unknown'),
    year: Number(input.year ?? new Date().getFullYear()),
    mileageKm: Number(input.mileageKm ?? input.mileage ?? 0),
    fuel: String(input.fuel ?? 'Unknown'),
    transmission: String(input.transmission ?? 'Unknown'),
    bodyType: String(input.bodyType ?? 'Unknown'),
    engineLitres: Number(input.engineLitres ?? 0),
    colour: String(input.colour ?? 'Unknown'),
    price: Number(input.price ?? 0),
    status: 'active',
    dateAdded: String(input.dateAdded ?? new Date().toISOString()),
    location: String(input.location ?? 'Unknown'),
    vehicleUrl: String(input.vehicleUrl ?? ''),
    imageUrl: String(input.imageUrl ?? ''),
    notes: [],
    priceHistory: [],
  };
}

export async function syncAutoXpressFeedInventory(feedUrl?: string): Promise<InventorySyncResult | null> {
  const resolvedFeedUrl = feedUrl ?? env.autoxpressFeedUrl;
  if (!resolvedFeedUrl) {
    return null;
  }

  const response = await fetch(resolvedFeedUrl);
  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { vehicles?: unknown[] }).vehicles)
      ? (payload as { vehicles: unknown[] }).vehicles
      : [];

  const vehicles = records.map((record, index) => normalizeFeedVehicle(record as Record<string, unknown>, index));

  return {
    vehicles,
    rawPayloads: vehicles.map((vehicle, index) => ({
      externalId: vehicle.stockId,
      listingUrl: vehicle.vehicleUrl,
      payload: records[index] ?? vehicle,
      htmlSnapshot: null,
    })),
    message: `Imported ${vehicles.length} AutoXpress vehicles from the configured feed.`,
  };
}
