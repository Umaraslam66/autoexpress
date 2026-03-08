import type { ComparableListing, Vehicle } from '../../src/types.js';
import { dismissConsent, withBrowserContext } from '../lib/browser.js';
import { scoreComparable } from '../lib/matching.js';
import { cleanText, extractStyleUrl, parseCurrency, parseNumber, safeModelSlug, slugify } from '../lib/parse.js';

interface SearchOptions {
  maxResults: number;
}

export async function scrapeCarzoneComparables(vehicle: Vehicle, options: SearchOptions): Promise<ComparableListing[]> {
  return withBrowserContext(async (_context, page) => {
    const searchUrl = `https://www.carzone.ie/used-cars/${slugify(vehicle.make)}/${safeModelSlug(vehicle.model)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissConsent(page);
    await page.waitForSelector('.stock-summary', { timeout: 30000 });

    // Use string-based evaluation to avoid tsx transpilation issues
    const evalScript = `
      (function(sourceUrl) {
        function text(node) {
          var content = node && node.textContent ? node.textContent : '';
          return content.replace(/\\s+/g, ' ').trim();
        }

        return Array.from(document.querySelectorAll('.stock-summary')).map(function(card) {
          var linkElem = card.querySelector('a[href*="/fpa/"]');
          var href = linkElem && linkElem.getAttribute ? linkElem.getAttribute('href') || '' : '';

          var title = text(card.querySelector('h2'));
          var description = text(card.querySelector('.stock-summary__description'));
          var details = text(card.querySelector('.stock-summary__features__details strong'));
          var dealerLocation = text(card.querySelector('.stock-summary__features__dealer'));

          var priceText =
            text(card.querySelector('aside .stock-summary__price .cz-price span span')) ||
            text(card.querySelector('.stock-summary__price .cz-price span span'));

          var imgElem = card.querySelector('.stock-summary__image');
          var imageStyle = imgElem && imgElem.style && imgElem.style.backgroundImage ? imgElem.style.backgroundImage : '';

          return {
            href: href,
            title: title,
            description: description,
            details: details,
            dealerLocation: dealerLocation,
            priceText: priceText,
            imageStyle: imageStyle,
            sourceUrl: sourceUrl
          };
        });
      })("${searchUrl.replace(/"/g, '\\"')}")
    `;
    const rawListings = (await page.evaluate(evalScript)) as any[];

    const scrapedAt = new Date().toISOString();

    return rawListings
      .filter((listing) => Boolean(listing.href) && Boolean(listing.title))
      .map((listing, index) => {
        const metadata = cleanText(listing.details);
        const yearMatch = metadata.match(/\b(19|20)\d{2}\b/);
        const mileageMatch = metadata.match(/([\d,]+)\s*km/i);
        const fuelMatch = metadata.match(/•\s*([\d.]+\s+[A-Za-z ]+)$/);
        const normalizedHref = new URL(listing.href, listing.sourceUrl).href;
        const listingIdMatch = normalizedHref.match(/\/fpa\/(\d+)/);
        const dealerLocation = cleanText(listing.dealerLocation.replace(/^Dealer/i, '')) || 'Unknown';
        const comparable: ComparableListing = {
          id: `carzone-${listingIdMatch?.[1] ?? index}`,
          vehicleId: vehicle.id,
          source: 'carzone',
          listingId: listingIdMatch?.[1] ?? String(index),
          listingUrl: normalizedHref,
          title: listing.title,
          make: vehicle.make,
          model: vehicle.model,
          variant: listing.title.replace(new RegExp(`^${vehicle.make}\\s+${vehicle.model}\\s*`, 'i'), '').trim() || listing.description,
          year: yearMatch ? Number.parseInt(yearMatch[0], 10) : vehicle.year,
          mileageKm: mileageMatch ? parseNumber(mileageMatch[1]) : 0,
          fuel: fuelMatch ? cleanText(fuelMatch[1].replace(/^[\d.]+\s*/, '')) : 'Unknown',
          transmission: 'Unknown',
          bodyType: 'Unknown',
          engineLitres: fuelMatch ? Number.parseFloat(cleanText(fuelMatch[1]).split(' ')[0]) : undefined,
          price: parseCurrency(listing.priceText),
          dealerName: 'Dealer listing',
          dealerLocation,
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

