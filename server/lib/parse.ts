export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseCurrency(value: string | null | undefined): number {
  const cleaned = cleanText(value).replace(/[^\d]/g, '');
  return cleaned ? Number.parseInt(cleaned, 10) : 0;
}

export function parseNumber(value: string | null | undefined): number {
  const cleaned = cleanText(value).replace(/[^\d]/g, '');
  return cleaned ? Number.parseInt(cleaned, 10) : 0;
}

export function parseYear(value: string | null | undefined): number {
  const match = cleanText(value).match(/\b(19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : new Date().getFullYear();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractStyleUrl(value: string | null | undefined): string {
  const match = cleanText(value).match(/url\(["']?(.*?)["']?\)/);
  return match?.[1] ?? '';
}

export function milesToKm(value: number): number {
  return Math.round(value * 1.60934);
}

export function safeModelSlug(model: string): string {
  return slugify(model.replace(/\//g, ' '));
}

