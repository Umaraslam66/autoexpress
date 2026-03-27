import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  comparableListings as demoComparableListings,
  jobRuns as demoJobRuns,
  normalizationRules as demoNormalizationRules,
  sourceHealth as demoSourceHealth,
  users as demoUsers,
  vehicles as demoVehicles,
} from '../data/mockData';
import { AUTH_BYPASS_ENABLED } from '../config';
import type {
  ApiBootstrapData,
  AppUser,
  ComparableListing,
  JobRun,
  NormalizationRule,
  PricingDecision,
  PricingDecisionCreateInput,
  PricingFileRecord,
  SourceHealth,
  Vehicle,
} from '../types';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';

interface AppStateValue {
  users: AppUser[];
  vehicles: Vehicle[];
  comparableListings: ComparableListing[];
  sourceHealth: SourceHealth[];
  jobRuns: JobRun[];
  normalizationRules: NormalizationRule[];
  dataMode: 'live' | 'seed';
  isSyncing: boolean;
  syncError: string | null;
  lastUpdatedAt: string | null;
  sourceMessages: string[];
  activeUser: AppUser | null;
  pricingDecisions: Record<string, PricingDecision>;
  excludedComparables: Record<string, string[]>;
  pricingFiles: PricingFileRecord[];
  /** Which scrape source is currently running ('all' | 'autoxpress' | 'carzone' | 'carsireland' | 'donedeal' | null) */
  scrapingSource: string | null;
  /** ISO timestamp when the current scrape started, for elapsed-time display */
  scrapingStartedAt: string | null;
  /** True during the very first bootstrap fetch — before we know live vs demo */
  isBootstrapping: boolean;
  dismissError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  bypassLogin: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  savePricingDecision: (vehicleId: string, input: PricingDecisionCreateInput) => Promise<void>;
  toggleComparable: (vehicleId: string, comparableId: string) => Promise<void>;
  createPricingFile: (vehicleId: string) => Promise<PricingFileRecord | null>;
  refresh: () => Promise<void>;
  runAdminRefresh: (source: 'all' | 'autoxpress' | 'carzone' | 'carsireland' | 'donedeal') => Promise<void>;
  runAdminBackfill: () => Promise<void>;
  resetStockTurn: (vehicleId: string) => Promise<void>;
}

const EMPTY_BOOTSTRAP: ApiBootstrapData = {
  users: [],
  vehicles: [],
  comparableListings: [],
  sourceHealth: [],
  jobRuns: [],
  normalizationRules: [],
  pricingDecisions: {},
  excludedComparables: {},
  pricingFiles: [],
  currentUser: null,
  dashboard: {
    totalVehicles: 0,
    sufficientComparables: 0,
    needingReview: 0,
    aboveMarket: 0,
    belowMarket: 0,
    averageDaysInStock: 0,
  },
  meta: {
    generatedAt: new Date().toISOString(),
    mode: 'seed',
    messages: ['Waiting for authenticated backend bootstrap.'],
  },
};

const AppStateContext = createContext<AppStateValue | undefined>(undefined);
const PREVIEW_SESSION_KEY = 'autoxpress.preview-user';

function getStoredPreviewUserId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(PREVIEW_SESSION_KEY);
}

function setStoredPreviewUserId(userId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (userId) {
    window.localStorage.setItem(PREVIEW_SESSION_KEY, userId);
    return;
  }
  window.localStorage.removeItem(PREVIEW_SESSION_KEY);
}

function buildPreviewBootstrap(currentUserId?: string | null): ApiBootstrapData {
  const pricingDecisions = {};
  const excludedComparables = {};
  const pricingFiles: PricingFileRecord[] = [];
  const insights = buildVehicleInsights(
    demoVehicles,
    demoComparableListings,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
  );

  return {
    users: demoUsers,
    vehicles: demoVehicles,
    comparableListings: demoComparableListings,
    sourceHealth: demoSourceHealth,
    jobRuns: demoJobRuns,
    normalizationRules: demoNormalizationRules,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
    currentUser: demoUsers.find((user) => user.id === currentUserId) ?? demoUsers[0] ?? null,
    dashboard: {
      totalVehicles: demoVehicles.length,
      sufficientComparables: insights.filter((insight) => insight.pricing.comparableCount >= 3).length,
      needingReview: insights.filter((insight) => insight.needsReview).length,
      aboveMarket: insights.filter((insight) => insight.pricing.currentPosition === 'above_market').length,
      belowMarket: insights.filter((insight) => insight.pricing.currentPosition === 'below_market').length,
      averageDaysInStock:
        insights.length === 0
          ? 0
          : Math.round(
              insights.reduce(
                (total, insight) =>
                  total +
                  Math.max(
                    0,
                    Math.round(
                      (Date.now() - new Date(insight.vehicle.stockClockStartAt ?? insight.vehicle.dateAdded).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  ),
                0,
              ) / insights.length,
            ),
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: 'seed',
      messages: [
        'Preview bypass is active. The app is using curated sample data without backend authentication.',
        'Writes, live refresh jobs, and scraper-backed data changes are disabled in this mode.',
      ],
    },
  };
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [dataState, setDataState] = useState<ApiBootstrapData>(EMPTY_BOOTSTRAP);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  const [scrapingSource, setScrapingSource] = useState<string | null>(null);
  const [scrapingStartedAt, setScrapingStartedAt] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function loadBootstrap(user: AppUser | null) {
    if (!user) {
      setDataState({
        ...EMPTY_BOOTSTRAP,
        currentUser: null,
      });
      return;
    }

    const payload = await fetchJson<ApiBootstrapData>('/api/bootstrap');
    setDataState(payload);
  }

  async function refresh() {
    setIsSyncing(true);
    setSyncError(null);

    try {
      if (AUTH_BYPASS_ENABLED) {
        const previewUserId = getStoredPreviewUserId();
        if (previewUserId) {
          const previewBootstrap = buildPreviewBootstrap(previewUserId);
          setActiveUser(previewBootstrap.currentUser);
          setDataState(previewBootstrap);
          return;
        }
      }

      const session = await fetchJson<{ user: AppUser | null }>('/api/auth/me');
      setActiveUser(session.user);
      await loadBootstrap(session.user);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unknown bootstrap error');
      setActiveUser(null);
      setDataState({
        ...EMPTY_BOOTSTRAP,
        currentUser: null,
      });
    } finally {
      setIsSyncing(false);
      setIsBootstrapping(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      users: dataState.users,
      vehicles: dataState.vehicles,
      comparableListings: dataState.comparableListings,
      sourceHealth: dataState.sourceHealth,
      jobRuns: dataState.jobRuns,
      normalizationRules: dataState.normalizationRules,
      dataMode: dataState.meta.mode,
      isSyncing,
      syncError,
      lastUpdatedAt: dataState.meta.generatedAt,
      sourceMessages: dataState.meta.messages,
      activeUser,
      pricingDecisions: dataState.pricingDecisions,
      excludedComparables: dataState.excludedComparables,
      pricingFiles: dataState.pricingFiles,
      scrapingSource,
      scrapingStartedAt,
      isBootstrapping,
      dismissError: () => setSyncError(null),
      login: async (email, password) => {
        try {
          setStoredPreviewUserId(null);
          const payload = await fetchJson<{ user: AppUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });
          setActiveUser(payload.user);
          await loadBootstrap(payload.user);
          return true;
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'Login failed.');
          return false;
        }
      },
      bypassLogin: async (userId) => {
        setSyncError(null);
        setStoredPreviewUserId(userId);
        const previewBootstrap = buildPreviewBootstrap(userId);
        setActiveUser(previewBootstrap.currentUser);
        setDataState(previewBootstrap);
        setIsBootstrapping(false);
      },
      logout: async () => {
        const previewUserId = getStoredPreviewUserId();
        setStoredPreviewUserId(null);
        if (!previewUserId) {
          await fetchJson('/api/auth/logout', {
            method: 'POST',
          });
        }
        setActiveUser(null);
        setDataState({
          ...EMPTY_BOOTSTRAP,
          currentUser: null,
        });
      },
      savePricingDecision: async (vehicleId, input) => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is read-only. Pricing decisions are disabled in this environment.');
          return;
        }
        await fetchJson(`/api/vehicles/${vehicleId}/decision`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
        await refresh();
      },
      toggleComparable: async (vehicleId, comparableId) => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is read-only. Comparable exclusions are disabled in this environment.');
          return;
        }
        const excludedIds = dataState.excludedComparables[vehicleId] ?? [];
        await fetchJson(`/api/vehicles/${vehicleId}/exclusions`, {
          method: 'POST',
          body: JSON.stringify({
            comparableId,
            excluded: !excludedIds.includes(comparableId),
          }),
        });
        await refresh();
      },
      createPricingFile: async (vehicleId) => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is read-only. Pricing file generation is disabled in this environment.');
          return null;
        }
        const payload = await fetchJson<{ record: PricingFileRecord }>(`/api/pricing-files`, {
          method: 'POST',
          body: JSON.stringify({ vehicleId }),
        });
        await refresh();
        return payload.record;
      },
      refresh,
      runAdminRefresh: async (source) => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is active. Live source refresh is disabled in this environment.');
          return;
        }
        setScrapingSource(source);
        setScrapingStartedAt(new Date().toISOString());
        setSyncError(null);
        try {
          await fetchJson('/api/admin/refresh', {
            method: 'POST',
            body: JSON.stringify({ source }),
          });
          await refresh();
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'Scrape failed — check the job history for details.');
        } finally {
          setScrapingSource(null);
          setScrapingStartedAt(null);
        }
      },
      runAdminBackfill: async () => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is active. Backfill is disabled in this environment.');
          return;
        }
        setScrapingSource('all');
        setScrapingStartedAt(new Date().toISOString());
        setSyncError(null);
        try {
          await fetchJson('/api/admin/backfill', {
            method: 'POST',
          });
          await refresh();
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : 'Backfill failed.');
        } finally {
          setScrapingSource(null);
          setScrapingStartedAt(null);
        }
      },
      resetStockTurn: async (vehicleId) => {
        if (dataState.meta.mode === 'seed') {
          setSyncError('Demo mode is read-only. Stock turn reset is disabled in this environment.');
          return;
        }
        await fetchJson(`/api/vehicles/${vehicleId}/stock-turn/reset`, {
          method: 'POST',
        });
        await refresh();
      },
    }),
    [activeUser, dataState, isSyncing, syncError, scrapingSource, scrapingStartedAt, isBootstrapping],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
