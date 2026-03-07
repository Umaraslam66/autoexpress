import { env } from '../../../config/env.js';
import { scrapeAutoXpressInventory } from '../../../scrapers/autoxpress.js';
import type { InventorySyncResult } from './types.js';

export async function syncAutoXpressWebInventory(): Promise<InventorySyncResult> {
  const vehicles = await scrapeAutoXpressInventory({
    maxVehicles: env.scrapeMaxVehicles,
    maxPages: env.scrapeMaxAutoXpressPages,
  });

  return {
    vehicles,
    rawPayloads: vehicles.map((vehicle) => ({
      externalId: vehicle.stockId,
      listingUrl: vehicle.vehicleUrl,
      payload: vehicle,
      htmlSnapshot: null,
    })),
    message: `Scraped ${vehicles.length} AutoXpress vehicles from the public website.`,
  };
}
