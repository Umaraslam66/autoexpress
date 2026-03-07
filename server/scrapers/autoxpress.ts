import type { Vehicle } from '../../src/types.js';
import { withBrowserContext } from '../lib/browser.js';
import { cleanText, milesToKm, parseCurrency, parseNumber, parseYear } from '../lib/parse.js';

interface AutoXpressScrapeOptions {
  maxVehicles: number;
  maxPages: number;
}

export async function scrapeAutoXpressInventory(options: AutoXpressScrapeOptions): Promise<Vehicle[]> {
  const collected = new Map<string, Vehicle>();

  await withBrowserContext(async (_context, page) => {
    await page.goto('https://www.autoxpress.ie/search', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.car-tile', { timeout: 30000 });

    for (let pageIndex = 0; pageIndex < options.maxPages; pageIndex += 1) {
      const vehicles = await page.evaluate((scrapedAt) => {
        const text = (selector: ParentNode | null, query: string) =>
          (selector?.querySelector(query)?.textContent ?? '').replace(/\s+/g, ' ').trim();

        return Array.from(document.querySelectorAll('.car-tile')).map((card) => {
          const href =
            (card.querySelector('a[href*="/vehicle?id="]') as HTMLAnchorElement | null)?.getAttribute('href') ?? '';
          const specs = Array.from(card.querySelectorAll('.car-desc__new td')).map((cell) =>
            (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
          );
          const title = text(card, '.car-title h2');
          const subtitle = text(card, '.car-title p');
          const imageUrl = (card.querySelector('.car-image img') as HTMLImageElement | null)?.src ?? '';

          return {
            href,
            title,
            subtitle,
            priceText: text(card, '.car-full-price .price-wrapper'),
            monthlyText: text(card, '.car-monthly-price .price-wrapper'),
            location: text(card, '.location-wrapper p'),
            imageUrl,
            specs,
            scrapedAt,
          };
        });
      }, new Date().toISOString());

      for (const item of vehicles) {
        const idMatch = item.href.match(/id=([^&]+)/);
        if (!idMatch || collected.has(idMatch[1])) {
          continue;
        }

        const specOne = cleanText(item.specs[0]);
        const engineMatch = specOne.match(/([\d.]+)/);
        const engineLitres = engineMatch ? Number.parseFloat(engineMatch[1]) : 0;
        const fuel = cleanText(specOne.replace(/^[\d.]+\s*/, '')) || 'Unknown';
        const mileageMiles = parseNumber(item.specs[1]);
        const [titleYear, make = 'Unknown', ...modelParts] = cleanText(item.title).split(/\s+/);
        const model = modelParts.join(' ') || 'Unknown';
        const vehicleId = `autoxpress-${idMatch[1]}`;
        const price = parseCurrency(item.priceText);

        collected.set(vehicleId, {
          id: vehicleId,
          stockId: idMatch[1],
          registration: 'Unknown',
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
          colour: 'Unknown',
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

      if (collected.size >= options.maxVehicles) {
        break;
      }

      const nextButton = page.locator('a', { hasText: 'Next' }).first();
      if (!(await nextButton.isVisible().catch(() => false))) {
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
        break;
      }
    }
  });

  return Array.from(collected.values()).slice(0, options.maxVehicles);
}

