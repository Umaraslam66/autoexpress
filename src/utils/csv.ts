import type { ComparableListing, PricingDecision, PricingFileRecord, Vehicle } from '../types.js';
import { formatDateTime } from './format.js';

function escapeCsv(value: string | number): string {
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInventoryCsv(vehicles: Vehicle[]): void {
  const rows: Array<Array<string | number>> = [
    ['Stock ID', 'Registration', 'Vehicle', 'Year', 'Mileage KM', 'Price', 'Location', 'Status'],
    ...vehicles.map((vehicle) => [
      vehicle.stockId,
      vehicle.registration,
      `${vehicle.make} ${vehicle.model} ${vehicle.variant}`,
      vehicle.year,
      vehicle.mileageKm,
      vehicle.price,
      vehicle.location,
      vehicle.status,
    ]),
  ];

  downloadCsv('autoxpress-inventory.csv', rows);
}

export function exportPricingFileCsv(
  vehicle: Vehicle,
  comparables: ComparableListing[],
  decision: PricingDecision | undefined,
  record: PricingFileRecord,
): void {
  const rows: Array<Array<string | number>> = [
    ['Pricing File ID', record.id],
    ['Vehicle', `${vehicle.make} ${vehicle.model} ${vehicle.variant}`],
    ['Stock ID', vehicle.stockId],
    ['Created At', formatDateTime(record.createdAt)],
    ['Created By', record.createdBy],
    ['Current Price', vehicle.price],
    ['Recommendation Target', record.recommendationTarget],
    ['Final Target', record.finalTarget],
    ['Decision Note', decision?.note ?? record.note],
    [],
    ['Comparable Source', 'Dealer', 'Year', 'Mileage KM', 'Price', 'Match Score', 'URL'],
    ...comparables.map((listing) => [
      listing.source,
      listing.dealerName,
      listing.year,
      listing.mileageKm,
      listing.price,
      listing.matchScore,
      listing.listingUrl,
    ]),
  ];

  downloadCsv(`${vehicle.stockId.toLowerCase()}-pricing-file.csv`, rows);
}
