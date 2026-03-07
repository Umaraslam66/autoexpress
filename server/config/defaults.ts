export const DEFAULT_DEALERSHIP = {
  name: 'AutoXpress',
  slug: 'autoxpress',
};

export const DEFAULT_USERS = [
  {
    name: 'Ava Nolan',
    email: 'admin@autoxpress.ie',
    role: 'admin' as const,
    password: 'autoxpress',
  },
  {
    name: 'Conor Walsh',
    email: 'pricing@autoxpress.ie',
    role: 'pricing_manager' as const,
    password: 'autoxpress',
  },
];

export const DEFAULT_NORMALIZATION_RULES = [
  { dictionary: 'fuel', sourceValue: 'petrol', canonicalValue: 'Petrol' },
  { dictionary: 'fuel', sourceValue: 'diesel', canonicalValue: 'Diesel' },
  { dictionary: 'fuel', sourceValue: 'hybrid', canonicalValue: 'Hybrid' },
  { dictionary: 'fuel', sourceValue: 'phev', canonicalValue: 'Hybrid' },
  { dictionary: 'transmission', sourceValue: 'auto', canonicalValue: 'Automatic' },
  { dictionary: 'transmission', sourceValue: 'automatic', canonicalValue: 'Automatic' },
  { dictionary: 'transmission', sourceValue: 'manual', canonicalValue: 'Manual' },
  { dictionary: 'body_type', sourceValue: 'hatchback', canonicalValue: 'Hatchback' },
  { dictionary: 'body_type', sourceValue: 'saloon', canonicalValue: 'Saloon' },
  { dictionary: 'body_type', sourceValue: 'suv', canonicalValue: 'SUV' },
  { dictionary: 'body_type', sourceValue: 'estate', canonicalValue: 'Estate' },
  { dictionary: 'location', sourceValue: 'co. dublin', canonicalValue: 'Dublin' },
  { dictionary: 'location', sourceValue: 'co. kildare', canonicalValue: 'Kildare' },
  { dictionary: 'location', sourceValue: 'co. limerick', canonicalValue: 'Limerick' },
  { dictionary: 'location', sourceValue: 'co. galway', canonicalValue: 'Galway' },
];
