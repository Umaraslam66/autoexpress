import type { Vehicle } from '../../src/types.js';
import { withBrowserContext } from '../lib/browser.js';
import { cleanText, milesToKm, parseCurrency, parseNumber, parseYear } from '../lib/parse.js';

interface AutoXpressScrapeOptions {
  maxVehicles: number;
  maxPages: number;
}

interface VehicleListingData {
  href: string;
  title: string;
  subtitle: string;
  priceText: string;
  monthlyText: string;
  location: string;
  imageUrl: string;
  specs: string[];
  scrapedAt: string;
}

export async function scrapeAutoXpressInventory(options: AutoXpressScrapeOptions): Promise<Vehicle[]> {
  const collected = new Map<string, Vehicle>();
  const listingData: VehicleListingData[] = [];

  await withBrowserContext(async (_context, page) => {
    // PASS 1: Collect all vehicle listings from all pages
    console.log('Pass 1: Collecting vehicle listings from all pages...');
    await page.goto('https://www.autoxpress.ie/search', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.car-tile', { timeout: 30000 });

    for (let pageIndex = 0; pageIndex < options.maxPages; pageIndex += 1) {
      const scrapedAt = new Date().toISOString();

      // Use string-based evaluation to avoid tsx transpilation issues
      const evalScript = `
        (function(scrapedAt) {
          function text(selector, query) {
            var elem = selector && selector.querySelector ? selector.querySelector(query) : null;
            var content = elem && elem.textContent ? elem.textContent : '';
            return content.replace(/\\s+/g, ' ').trim();
          }

          return Array.from(document.querySelectorAll('.car-tile')).map(function(card) {
            var linkElem = card.querySelector('a[href*="/vehicle?id="]');
            var href = linkElem && linkElem.getAttribute ? linkElem.getAttribute('href') || '' : '';

            var specs = Array.from(card.querySelectorAll('.car-desc__new td')).map(function(cell) {
              return cell.textContent ? cell.textContent.replace(/\\s+/g, ' ').trim() : '';
            });

            var title = text(card, '.car-title h2');
            var subtitle = text(card, '.car-title p');

            var imgElem = card.querySelector('.car-image img');
            var imageUrl = imgElem && imgElem.src ? imgElem.src : '';

            return {
              href: href,
              title: title,
              subtitle: subtitle,
              priceText: text(card, '.car-full-price .price-wrapper'),
              monthlyText: text(card, '.car-monthly-price .price-wrapper'),
              location: text(card, '.location-wrapper p'),
              imageUrl: imageUrl,
              specs: specs,
              scrapedAt: scrapedAt
            };
          });
        })("${scrapedAt}")
      `;
      const vehicles = (await page.evaluate(evalScript)) as VehicleListingData[];

      for (const item of vehicles) {
        const idMatch = item.href.match(/id=([^&]+)/);
        if (!idMatch) continue;

        // Check for duplicates
        const alreadyCollected = listingData.some(v => v.href === item.href);
        if (alreadyCollected) continue;

        listingData.push(item);

        if (listingData.length >= options.maxVehicles) {
          break;
        }
      }

      console.log(`  Page ${pageIndex + 1}: Collected ${vehicles.length} vehicles (Total: ${listingData.length})`);

      if (listingData.length >= options.maxVehicles) {
        break;
      }

      const nextButton = page.locator('a', { hasText: 'Next' }).first();
      if (!(await nextButton.isVisible().catch(() => false))) {
        console.log('  No more pages available');
        break;
      }

      const previousFirstHref = vehicles[0]?.href;
      await nextButton.click().catch(() => undefined);
      await page.waitForTimeout(1200);

      const firstHrefAfter = await page
        .locator('.car-tile a[href*="/vehicle?id="]')
        .first()
        .getAttribute('href')
        .catch(() => null);

      if (!firstHrefAfter || firstHrefAfter === previousFirstHref) {
        console.log('  Pagination loop detected, stopping');
        break;
      }
    }

    console.log(`\nPass 1 Complete: ${listingData.length} vehicles collected`);

    // PASS 2: Visit each vehicle detail page to get colour and registration
    console.log('\nPass 2: Fetching detailed information for each vehicle...');

    for (let idx = 0; idx < listingData.length; idx++) {
      const item = listingData[idx];
      const idMatch = item.href.match(/id=([^&]+)/);
      if (!idMatch) continue;

      const vehicleId = `autoxpress-${idMatch[1]}`;

      // Parse basic info from listing
      const specOne = cleanText(item.specs[0]);
      const engineMatch = specOne.match(/([\d.]+)/);
      const engineLitres = engineMatch ? Number.parseFloat(engineMatch[1]) : 0;
      const fuel = cleanText(specOne.replace(/^[\d.]+\s*/, '')) || 'Unknown';
      const mileageMiles = parseNumber(item.specs[1]);
      const [titleYear, make = 'Unknown', ...modelParts] = cleanText(item.title).split(/\s+/);
      const model = modelParts.join(' ') || 'Unknown';
      const price = parseCurrency(item.priceText);

      // Visit detail page for colour and registration
      let colour = 'Unknown';
      let registration = 'Unknown';

      try {
        const detailUrl = new URL(item.href, 'https://www.autoxpress.ie').href;
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait for detail section with shorter timeout since we're doing many pages
        await page.waitForTimeout(500);

        // Extract colour and registration from detail page
        const detailScript = `
          (function() {
            var colour = 'Unknown';
            var registration = 'Unknown';

            // Try to find colour - look in metadata list
            var metaItems = Array.from(document.querySelectorAll('.car-details .meta-data__list .meta-data__list-item'));
            for (var i = 0; i < metaItems.length; i++) {
              var itemText = (metaItems[i].textContent || '').toLowerCase();

              if (itemText.includes('colour') || itemText.includes('color')) {
                var match = itemText.match(/colou?r[:\\s]*([a-z\\s]+)/i);
                if (match && match[1]) {
                  colour = match[1].trim();
                }
              }

              if (itemText.includes('registration') || itemText.includes('reg')) {
                var regMatch = itemText.match(/(?:reg|registration)[:\\s]*([0-9]{2}[- ]?[a-z]{1,2}[- ]?[0-9]+)/i);
                if (regMatch && regMatch[1]) {
                  registration = regMatch[1].trim();
                }
              }
            }

            // Alternative: Look in all paragraphs and spans
            if (colour === 'Unknown') {
              var allText = Array.from(document.querySelectorAll('p, span, div, td, li'));
              for (var j = 0; j < allText.length; j++) {
                var text = (allText[j].textContent || '').trim();

                // Look for colour pattern
                if (text.toLowerCase().includes('colour')) {
                  var colMatch = text.match(/colou?r[:\\s]*([a-z\\s]{3,20})/i);
                  if (colMatch && colMatch[1]) {
                    colour = colMatch[1].trim();
                    break;
                  }
                }
              }
            }

            return { colour: colour, registration: registration };
          })()
        `;

        const detailData = (await page.evaluate(detailScript)) as { colour: string; registration: string };
        colour = detailData.colour !== 'Unknown' ? cleanText(detailData.colour) : 'Unknown';
        registration = detailData.registration !== 'Unknown' ? cleanText(detailData.registration) : 'Unknown';

        // Small delay to avoid hammering the server
        await page.waitForTimeout(300);
      } catch (err) {
        console.error(`  [${idx + 1}/${listingData.length}] Failed to fetch details for ${vehicleId}:`, (err as Error).message);
      }

      if ((idx + 1) % 10 === 0) {
        console.log(`  Progress: ${idx + 1}/${listingData.length} vehicles processed`);
      }

      collected.set(vehicleId, {
        id: vehicleId,
        stockId: idMatch[1],
        registration,
        vinFragment: '',
        make,
        model,
        variant: item.subtitle || model,
        year: parseYear(titleYear),
        mileageKm: mileageMiles ? milesToKm(mileageMiles) : 0,
        fuel,
        transmission: cleanText(item.specs[2]) || 'Unknown',
        bodyType: cleanText(item.specs[3]) || 'Unknown',
        engineLitres,
        colour,
        price,
        status: 'active',
        dateAdded: item.scrapedAt,
        location: cleanText(item.location.replace(/^AutoXpress,\s*/i, '')) || 'Unknown',
        vehicleUrl: new URL(item.href, 'https://www.autoxpress.ie').href,
        imageUrl: item.imageUrl,
        notes: [],
        priceHistory: [
          {
            changedAt: item.scrapedAt,
            price,
            changedBy: 'Live scrape',
          },
        ],
      });
    }

    console.log(`\nPass 2 Complete: ${collected.size} vehicles with full details`);
  });

  return Array.from(collected.values()).slice(0, options.maxVehicles);
}
