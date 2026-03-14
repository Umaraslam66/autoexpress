/**
 * Parallel comparable sync — now superseded by the deduplication logic baked
 * directly into syncComparableSource() in service.ts.
 *
 * This module is intentionally kept thin; it delegates to the main service so
 * there is a single implementation to maintain.
 */
export { syncMarketComparablesNow as syncMarketComparablesParallel } from './service.js';
