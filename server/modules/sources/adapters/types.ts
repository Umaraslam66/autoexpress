import type { ComparableListing, Vehicle } from '../../../../src/types.js';

export interface InventorySyncResult {
  vehicles: Vehicle[];
  rawPayloads: Array<{ externalId: string; listingUrl?: string; payload: unknown; htmlSnapshot?: string | null }>;
  message: string;
}

export interface ComparableSyncResult {
  listings: ComparableListing[];
  rawPayloads: Array<{ externalId: string; listingUrl?: string; payload: unknown; htmlSnapshot?: string | null }>;
  message: string;
}
