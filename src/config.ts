// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || '';
export const AUTH_BYPASS_ENABLED = import.meta.env.VITE_AUTH_BYPASS_ENABLED
  ? import.meta.env.VITE_AUTH_BYPASS_ENABLED === 'true'
  : import.meta.env.DEV;
export const QUICK_LOGIN_ENABLED = import.meta.env.VITE_QUICK_LOGIN_ENABLED !== 'false';
export const QUICK_LOGIN_ACCOUNTS = [
  {
    label: 'Enter as Admin',
    email: import.meta.env.VITE_QUICK_LOGIN_ADMIN_EMAIL || 'admin@autoxpress.ie',
    password: import.meta.env.VITE_QUICK_LOGIN_ADMIN_PASSWORD || 'autoxpress',
  },
  {
    label: 'Enter as Pricing',
    email: import.meta.env.VITE_QUICK_LOGIN_PRICING_EMAIL || 'pricing@autoxpress.ie',
    password: import.meta.env.VITE_QUICK_LOGIN_PRICING_PASSWORD || 'autoxpress',
  },
] as const;
export const BYPASS_LOGIN_USERS = [
  {
    id: 'user-admin',
    label: 'Preview as Admin',
  },
  {
    id: 'user-pricing',
    label: 'Preview as Pricing',
  },
] as const;

// Use this in all API calls
// Example: fetch(`${API_URL}/api/vehicles`)
