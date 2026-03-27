import type { RawScrapedListing } from './rawTypes.js';
import { dismissConsent, gotoWithRetry, withBrowserContext } from '../lib/browser.js';
import { cleanText, extractStyleUrl, parseCurrency, parseNumber } from '../lib/parse.js';

const RAW_POOL_SIZE = 50;

function parseFuelAndTransmission(text: string): { fuel: string; transmission: string } {
  const value = text.toLowerCase();
  let fuel = 'Unknown';
  let transmission = 'Unknown';

  if (value.includes('diesel') || value.includes('tdi')) {
    fuel = 'Diesel';
  } else if (value.includes('petrol') || value.includes('tsi') || value.includes('tfsi')) {
    fuel = 'Petrol';
  } else if (value.includes('hybrid') || value.includes('phev')) {
    fuel = 'Hybrid';
  } else if (value.includes('electric') || value.includes('ev')) {
    fuel = 'Electric';
  }

  if (value.includes('automatic') || value.includes('auto') || value.includes('dsg')) {
    transmission = 'Automatic';
  } else if (value.includes('manual')) {
    transmission = 'Manual';
  }

  return { fuel, transmission };
}

export async function scrapeDoneDealMakeModel(make: string, model: string): Promise<RawScrapedListing[]> {
  return withBrowserContext(async (_context, page) => {
    const searchUrl = `https://www.donedeal.ie/cars?words=${encodeURIComponent(`${make} ${model}`)}`;
    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissConsent(page);
    await page.waitForTimeout(2000);

    const cardsFound = await page
      .waitForSelector('article, [data-testid*="listing-card"]', { timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!cardsFound) {
      const pageTitle = await page.title().catch(() => 'unknown');
      console.warn(`[DoneDeal] Selector not found for ${make} ${model}. Page title: "${pageTitle}" | URL: ${page.url()}`);
      return [];
    }

    const rawListings = (await page.evaluate(() => {
      function text(node: Element | null | undefined): string {
        return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
      }

      const cards = Array.from(document.querySelectorAll('article, [data-testid*="listing-card"]'));
      return cards.map((card) => {
        const anchor = card.querySelector('a[href*="/cars-for-sale/"], a[href*="/cars/"]');
        const priceNode = card.querySelector('[data-testid="price"], [class*="price"]');
        const metaNodes = Array.from(card.querySelectorAll('li, [class*="metadata"], [class*="attribute"]'))
          .map((node) => text(node))
          .filter(Boolean);
        const imageNode = card.querySelector('img');

        return {
          href: anchor?.getAttribute('href') ?? '',
          title: text(card.querySelector('h1, h2, h3')) || text(anchor),
          priceText: text(priceNode),
          meta: metaNodes,
          imageUrl: imageNode?.getAttribute('src') ?? '',
        };
      });
    })) as Array<{ href: string; title: string; priceText: string; meta: string[]; imageUrl: string }>;

    const scrapedAt = new Date().toISOString();
    const results: RawScrapedListing[] = [];

    for (const [index, listing] of rawListings.entries()) {
      if (!listing.href || !listing.title) {
        continue;
      }
      if (results.length >= RAW_POOL_SIZE) {
        break;
      }

      const normalizedHref = new URL(listing.href, searchUrl).href;
      const listingIdMatch = normalizedHref.match(/\/(\d+)(?:\?|$)/);
      const metadata = cleanText(listing.meta.join(' '));
      const yearMatch = metadata.match(/\b(19|20)\d{2}\b/);
      const mileageMatch = metadata.match(/([\d,]+)\s*km/i);
      const { fuel, transmission } = parseFuelAndTransmission(`${listing.title} ${metadata}`);

      results.push({
        source: 'donedeal',
        listingId: listingIdMatch?.[1] ?? String(index),
        listingUrl: normalizedHref,
        title: listing.title,
        make,
        model,
        variant: listing.title.replace(new RegExp(`^${make}\\s+${model}\\s*`, 'i'), '').trim(),
        year: yearMatch ? Number.parseInt(yearMatch[0], 10) : 0,
        mileageKm: mileageMatch ? parseNumber(mileageMatch[1]) : 0,
        fuel,
        transmission,
        bodyType: 'Unknown',
        engineLitres: undefined,
        price: parseCurrency(listing.priceText),
        dealerName: 'DoneDeal listing',
        dealerLocation: 'Ireland',
        imageUrl: listing.imageUrl || extractStyleUrl(''),
        scrapedAt,
      });
    }

    return results;
  });
}
