import { syncMarketComparablesParallel } from './server/modules/sources/service-parallel.js';
import { recomputeDealershipPricing } from './server/modules/pricing/service.js';

async function runParallelScraping() {
  const dealershipId = 'cmmgvkazf0000itkjqos759h1'; // AutoXpress dealership ID

  console.log('\n=== STARTING PARALLEL COMPETITOR SCRAPING ===\n');
  const startTime = Date.now();

  try {
    console.log('Phase 1: Scraping Carzone (10 vehicles at a time)...');
    const carzoneStart = Date.now();
    const carzoneResult = await syncMarketComparablesParallel(dealershipId, 'carzone');
    const carzoneTime = ((Date.now() - carzoneStart) / 1000 / 60).toFixed(1);
    console.log(`✓ Carzone complete: ${carzoneResult.recordsProcessed} listings in ${carzoneTime} minutes\n`);

    console.log('Phase 2: Scraping CarsIreland (10 vehicles at a time)...');
    const carsIrelandStart = Date.now();
    const carsIrelandResult = await syncMarketComparablesParallel(dealershipId, 'carsireland');
    const carsIrelandTime = ((Date.now() - carsIrelandStart) / 1000 / 60).toFixed(1);
    console.log(`✓ CarsIreland complete: ${carsIrelandResult.recordsProcessed} listings in ${carsIrelandTime} minutes\n`);

    console.log('Phase 3: Generating pricing recommendations...');
    await recomputeDealershipPricing(dealershipId);
    console.log(`✓ Pricing recommendations generated\n`);

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`=== SCRAPING COMPLETE IN ${totalTime} MINUTES ===\n`);
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  }
}

runParallelScraping().catch(console.error);
