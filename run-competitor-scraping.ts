import { syncMarketComparablesNow } from './server/modules/sources/service.js';
import { recomputeDealershipPricing } from './server/modules/pricing/service.js';

async function runCompetitorScraping() {
  const dealershipId = 'cmmgvkazf0000itkjqos759h1'; // AutoXpress dealership ID

  console.log('\n=== STARTING COMPETITOR SCRAPING ===\n');

  try {
    console.log('Phase 1: Scraping Carzone...');
    const carzoneResult = await syncMarketComparablesNow(dealershipId, 'carzone');
    console.log(`✓ Carzone complete: ${carzoneResult.recordsProcessed} listings\n`);

    console.log('Phase 2: Scraping CarsIreland...');
    const carsIrelandResult = await syncMarketComparablesNow(dealershipId, 'carsireland');
    console.log(`✓ CarsIreland complete: ${carsIrelandResult.recordsProcessed} listings\n`);

    console.log('Phase 3: Generating pricing recommendations...');
    await recomputeDealershipPricing(dealershipId);
    console.log(`✓ Pricing recommendations generated\n`);

    console.log('=== SCRAPING COMPLETE ===\n');
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  }
}

runCompetitorScraping().catch(console.error);
