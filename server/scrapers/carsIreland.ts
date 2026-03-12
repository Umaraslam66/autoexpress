import type { ComparableListing, Vehicle } from '../../src/types.js';
import { dismissConsent, gotoWithRetry, withBrowserContext } from '../lib/browser.js';
import { scoreComparable } from '../lib/matching.js';
import { cleanText, extractStyleUrl, parseCurrency, parseNumber, safeModelSlug, slugify } from '../lib/parse.js';

interface SearchOptions {
  maxResults: number;
}

export async function scrapeCarsIrelandComparables(
  vehicle: Vehicle,
  options: SearchOptions,
): Promise<ComparableListing[]> {
  return withBrowserContext(async (_context, page) => {
    const searchUrl = `https://www.carsireland.ie/used-cars/${slugify(vehicle.make)}/${safeModelSlug(vehicle.model)}`;
    await gotoWithRetry(page, searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissConsent(page);
    // Allow JS content and any consent overlays to settle
    await page.waitForTimeout(2000);

    const selectorFound = await page
      .waitForSelector('a[href*="journey=Search"], a[href*="journey=FeaturedListing"]', { timeout: 60000 })
      .then(() => true)
      .catch(() => false);
    if (!selectorFound) {
      console.warn(`[CarsIreland] Listing selector not found for ${searchUrl} — site may be blocking or layout changed`);
      return [];
    }

    // Use string-based evaluation to avoid tsx transpilation issues
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

            // Extract price - need to get just the first price value, not monthly payment
            var pricingElement = anchor.querySelector('.cids-o-listing-card__details__pricing > span');
            var priceText = '';
            if (pricingElement && pricingElement.childNodes && pricingElement.childNodes.length > 0) {
              // Get the first text node which contains the main price
              var firstTextNode = pricingElement.childNodes[0];
              priceText = firstTextNode && firstTextNode.textContent ? firstTextNode.textContent.trim() : '';
            }
            if (!priceText) {
              priceText = text(pricingElement).split(/\s+/)[0] || ''; // Fallback: take first word
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

        // Try to extract fuel type from variant/description
        let fuel = 'Unknown';
        let transmission = 'Unknown';
        const variantLower = variant.toLowerCase();

        // Fuel type detection
        if (variantLower.includes('tdi') || variantLower.includes('diesel')) {
          fuel = 'Diesel';
        } else if (variantLower.includes('tsi') || variantLower.includes('tfsi') || variantLower.includes('petrol')) {
          fuel = 'Petrol';
        } else if (variantLower.includes('hybrid') || variantLower.includes('phev')) {
          fuel = 'Hybrid';
        } else if (variantLower.includes('electric') || variantLower.includes('ev')) {
          fuel = 'Electric';
        }

        // Transmission detection
        if (variantLower.includes('automatic') || variantLower.includes('auto') || variantLower.includes('dsg') || variantLower.includes('s-tronic')) {
          transmission = 'Automatic';
        } else if (variantLower.includes('manual')) {
          transmission = 'Manual';
        }

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
