/**
 * A listing as scraped from a competitor site — before any vehicle-specific
 * scoring or matching. One scrape of a make/model search page yields a pool
 * of these; they are then scored independently for each vehicle that shares
 * that make/model in inventory.
 */
export interface RawScrapedListing {
  source: 'carzone' | 'carsireland';
  listingId: string;
  listingUrl: string;
  title: string;
  /** The make that was searched (mirrors the inventory vehicle's make). */
  make: string;
  /** The model that was searched (mirrors the inventory vehicle's model). */
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
  imageUrl?: string;
  scrapedAt: string;
}
