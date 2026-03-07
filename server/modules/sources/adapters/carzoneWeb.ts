import { env } from '../../../config/env.js';
import { scrapeCarzoneComparables } from '../../../scrapers/carzone.js';
import type { Vehicle } from '../../../../src/types.js';
import type { ComparableSyncResult } from './types.js';

export async function syncCarzoneComparables(vehicle: Vehicle): Promise<ComparableSyncResult> {
  const listings = await scrapeCarzoneComparables(vehicle, {
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
    message: `Scraped ${listings.length} Carzone comparables for ${vehicle.stockId}.`,
  };
}
