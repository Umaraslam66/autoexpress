import { env } from '../../../config/env.js';
import { scrapeCarsIrelandComparables } from '../../../scrapers/carsIreland.js';
import type { Vehicle } from '../../../../src/types.js';
import type { ComparableSyncResult } from './types.js';

export async function syncCarsIrelandComparables(vehicle: Vehicle): Promise<ComparableSyncResult> {
  const listings = await scrapeCarsIrelandComparables(vehicle, {
    maxResults: env.scrapeMaxComparablesPerSource,
  });

  return {
    listings,
    rawPayloads: listings.map((listing) => ({
      externalId: listing.listingId,
      listingUrl: listing.listingUrl,
      payload: listing,
      htmlSnapshot: null,
    })),
    message: `Scraped ${listings.length} CarsIreland comparables for ${vehicle.stockId}.`,
  };
}
