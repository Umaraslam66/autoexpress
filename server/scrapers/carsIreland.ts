import type { ComparableListing, Vehicle } from '../../src/types.js';
import type { RawScrapedListing } from './rawTypes.js';
import { dismissConsent, gotoWithRetry, withBrowserContext } from '../lib/browser.js';
import { scoreComparable } from '../lib/matching.js';
import { extractStyleUrl, parseCurrency, parseNumber, safeModelSlug, slugify } from '../lib/parse.js';

// Maximum number of raw results fetched from a single make/model search page.
const RAW_POOL_SIZE = 50;

interface SearchOptions {
  maxResults: number;
}

function parseFuelAndTransmission(variant: string): { fuel: string; transmission: string } {
  const v = variant.toLowerCase();
  let fuel = 'Unknown';
  let transmission = 'Unknown';

  if (v.includes('tdi') || v.includes('diesel')) {
    fuel = 'Diesel';
  } else if (v.includes('tsi') || v.includes('tfsi') || v.includes('petrol')) {
    fuel = 'Petrol';
  } else if (v.includes('hybrid') || v.includes('phev')) {
    fuel = 'Hybrid';
  } else if (v.includes('electric') || v.includes('ev')) {
    fuel = 'Electric';
  }

  if (
    v.includes('automatic') ||
    v.includes('auto') ||
    v.includes('dsg') ||
    v.includes('s-tronic')
  ) {
    transmission = 'Automatic';
  } else if (v.includes('manual')) {
    transmission = 'Manual';
  }

  return { fuel, transmission };
}

/**
 * Scrape the CarsIreland search page for a given make/model and return raw,
 * un-scored listings. Call this once per unique (make, model) combination
 * rather than once per vehicle.
 */
export async function scrapeCarsIrelandMakeModel(make: string, model: string): Promise<RawScrapedListing[]> {
  return withBrowserContext(async (_context, page) => {
    const searchUrl = `https://www.carsireland.ie/used-cars/${slugify(make)}/${safeModelSlug(model)}`;
    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissConsent(page);
    await page.waitForTimeout(2000);

    const selectorFound = await page
      .waitForSelector('a[href*="journey=Search"], a[href*="journey=FeaturedListing"]', { timeout: 60000 })
      .then(() => true)
      .catch(() => false);

    if (!selectorFound) {
      const pageTitle = await page.title().catch(() => 'unknown');
      console.warn(`[CarsIreland] Selector not found for ${make} ${model}. Page title: "${pageTitle}" | URL: ${page.url()}`);
      return [];
    }

    const evalScript = `
      (function(sourceUrl) {
        function text(node) {
          var content = node && node.textContent ? node.textContent : '';
          return content.replace(/\\s+/g, ' ').trim();
        }

        return Array.from(document.querySelectorAll('a[href*="journey=Search"], a[href*="journey=FeaturedListing"]')).map(
          function(anchor) {
            var title = text(anchor.querySelector('h3'));

            var paragraphs = Array.from(anchor.querySelectorAll('p')).map(function(node) {
              return text(node);
            }).filter(Boolean);

            var year = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-year h3'));
            var reg = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-reg-detail'));
            var mileage = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-mileage'));
            var location = text(anchor.querySelector('.cids-o-listing-card__details__location-and-save-container__location'));

            var pricingElement = anchor.querySelector('.cids-o-listing-card__details__pricing > span');
            var priceText = '';
            if (pricingElement && pricingElement.childNodes && pricingElement.childNodes.length > 0) {
              var firstTextNode = pricingElement.childNodes[0];
              priceText = firstTextNode && firstTextNode.textContent ? firstTextNode.textContent.trim() : '';
            }
            if (!priceText) {
              priceText = text(pricingElement).split(/\\s+/)[0] || '';
            }

            var colour = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-color__color-text'));

            var imgElem = anchor.querySelector('.cids-o-listing-card__images__main__image');
            var imageStyle = imgElem && imgElem.style && imgElem.style.backgroundImage ? imgElem.style.backgroundImage : '';

            return {
              href: anchor.getAttribute ? anchor.getAttribute('href') || '' : '',
              title: title,
              paragraphs: paragraphs,
              year: year,
              reg: reg,
              mileage: mileage,
              location: location,
              priceText: priceText,
              colour: colour,
              imageStyle: imageStyle,
              sourceUrl: sourceUrl
            };
          }
        );
      })("${searchUrl.replace(/"/g, '\\"')}")
    `;
    const rawListings = (await page.evaluate(evalScript)) as any[];
    const scrapedAt = new Date().toISOString();

    const results: RawScrapedListing[] = [];

    for (const [index, listing] of rawListings.entries()) {
      if (!listing.href || !listing.title) continue;
      if (results.length >= RAW_POOL_SIZE) break;

      const normalizedHref = new URL(listing.href, listing.sourceUrl).href;
      const listingIdMatch = normalizedHref.match(/\/?(\d+)\?/);
      const variant = listing.paragraphs[0] ?? '';
      const { fuel, transmission } = parseFuelAndTransmission(variant);

      results.push({
        source: 'carsireland',
        listingId: listingIdMatch?.[1] ?? String(index),
        listingUrl: normalizedHref,
        title: listing.title,
        make,
        model,
        variant,
        year: listing.year ? Number.parseInt(listing.year, 10) : 0,
        mileageKm: parseNumber(listing.mileage),
        fuel,
        transmission,
        bodyType: 'Unknown',
        engineLitres: undefined,
        price: parseCurrency(listing.priceText),
        dealerName: 'Dealer listing',
        dealerLocation: listing.location || 'Unknown',
        imageUrl: extractStyleUrl(listing.imageStyle),
        scrapedAt,
      });
    }

    return results;
  });
}

/**
 * Legacy per-vehicle scraper — kept for the sequential fallback path in service.ts.
 * Prefer scrapeCarsIrelandMakeModel() + per-vehicle scoring for bulk operations.
 */
export async function scrapeCarsIrelandComparables(
  vehicle: Vehicle,
  options: SearchOptions,
): Promise<ComparableListing[]> {
  return withBrowserContext(async (_context, page) => {
    const searchUrl = `https://www.carsireland.ie/used-cars/${slugify(vehicle.make)}/${safeModelSlug(vehicle.model)}`;
    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissConsent(page);
    await page.waitForTimeout(2000);

    const selectorFound = await page
      .waitForSelector('a[href*="journey=Search"], a[href*="journey=FeaturedListing"]', { timeout: 60000 })
      .then(() => true)
      .catch(() => false);

    if (!selectorFound) {
      const pageTitle = await page.title().catch(() => 'unknown');
      const pageUrl = page.url();
      console.warn(`[CarsIreland] Selector not found. Page title: "${pageTitle}" | URL: ${pageUrl}`);
      return [];
    }

    const evalScript = `
      (function(sourceUrl) {
        function text(node) {
          var content = node && node.textContent ? node.textContent : '';
          return content.replace(/\\s+/g, ' ').trim();
        }

        return Array.from(document.querySelectorAll('a[href*="journey=Search"], a[href*="journey=FeaturedListing"]')).map(
          function(anchor) {
            var title = text(anchor.querySelector('h3'));

            var paragraphs = Array.from(anchor.querySelectorAll('p')).map(function(node) {
              return text(node);
            }).filter(Boolean);

            var year = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-year h3'));
            var reg = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-reg-detail'));
            var mileage = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-info__vehicle-mileage'));
            var location = text(anchor.querySelector('.cids-o-listing-card__details__location-and-save-container__location'));

            var pricingElement = anchor.querySelector('.cids-o-listing-card__details__pricing > span');
            var priceText = '';
            if (pricingElement && pricingElement.childNodes && pricingElement.childNodes.length > 0) {
              var firstTextNode = pricingElement.childNodes[0];
              priceText = firstTextNode && firstTextNode.textContent ? firstTextNode.textContent.trim() : '';
            }
            if (!priceText) {
              priceText = text(pricingElement).split(/\\s+/)[0] || '';
            }

            var colour = text(anchor.querySelector('.cids-o-listing-card__details__vehicle-color__color-text'));

            var imgElem = anchor.querySelector('.cids-o-listing-card__images__main__image');
            var imageStyle = imgElem && imgElem.style && imgElem.style.backgroundImage ? imgElem.style.backgroundImage : '';

            return {
              href: anchor.getAttribute ? anchor.getAttribute('href') || '' : '',
              title: title,
              paragraphs: paragraphs,
              year: year,
              reg: reg,
              mileage: mileage,
              location: location,
              priceText: priceText,
              colour: colour,
              imageStyle: imageStyle,
              sourceUrl: sourceUrl
            };
          }
        );
      })("${searchUrl.replace(/"/g, '\\"')}")
    `;
    const rawListings = (await page.evaluate(evalScript)) as any[];
    const scrapedAt = new Date().toISOString();

    return rawListings
      .filter((listing) => Boolean(listing.href) && Boolean(listing.title))
      .map((listing, index) => {
        const normalizedHref = new URL(listing.href, listing.sourceUrl).href;
        const listingIdMatch = normalizedHref.match(/\/?(\d+)\?/);
        const variant = listing.paragraphs[0] ?? '';
        const { fuel, transmission } = parseFuelAndTransmission(variant);

        const comparable: ComparableListing = {
          id: `carsireland-${listingIdMatch?.[1] ?? index}`,
          vehicleId: vehicle.id,
          source: 'carsireland',
          listingId: listingIdMatch?.[1] ?? String(index),
          listingUrl: normalizedHref,
          title: listing.title,
          make: vehicle.make,
          model: vehicle.model,
          variant,
          year: listing.year ? Number.parseInt(listing.year, 10) : vehicle.year,
          mileageKm: parseNumber(listing.mileage),
          fuel,
          transmission,
          bodyType: 'Unknown',
          engineLitres: undefined,
          price: parseCurrency(listing.priceText),
          dealerName: 'Dealer listing',
          dealerLocation: listing.location || 'Unknown',
          listedAt: scrapedAt,
          daysListed: 0,
          imageUrl: extractStyleUrl(listing.imageStyle),
          lastSeenAt: scrapedAt,
          matchScore: 0,
          confidence: 'low',
          explanation: [],
        };

        const scoring = scoreComparable(vehicle, comparable);
        comparable.matchScore = scoring.score;
        comparable.confidence = scoring.confidence;
        comparable.explanation = scoring.explanation;
        return comparable;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, options.maxResults);
  });
}
