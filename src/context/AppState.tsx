import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  savePricingDecision: (vehicleId: string, input: PricingDecisionCreateInput) => Promise<void>;
  toggleComparable: (vehicleId: string, comparableId: string) => Promise<void>;
  createPricingFile: (vehicleId: string) => Promise<PricingFileRecord | null>;
  refresh: () => Promise<void>;
  runAdminRefresh: (source: 'all' | 'autoxpress' | 'carzone' | 'carsireland') => Promise<void>;
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
      login: async (email, password) => {
        try {
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
      logout: async () => {
        await fetchJson('/api/auth/logout', {
          method: 'POST',
        });
        setActiveUser(null);
        setDataState({
          ...EMPTY_BOOTSTRAP,
          currentUser: null,
        });
      },
      savePricingDecision: async (vehicleId, input) => {
        await fetchJson(`/api/vehicles/${vehicleId}/decision`, {
          method: 'POST',
          body: JSON.stringify(input),
        });
        await refresh();
      },
      toggleComparable: async (vehicleId, comparableId) => {
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
        const payload = await fetchJson<{ record: PricingFileRecord }>(`/api/pricing-files`, {
          method: 'POST',
          body: JSON.stringify({ vehicleId }),
        });
        await refresh();
        return payload.record;
      },
      refresh,
      runAdminRefresh: async (source) => {
        await fetchJson('/api/admin/refresh', {
          method: 'POST',
          body: JSON.stringify({ source }),
        });
        await refresh();
      },
    }),
    [activeUser, dataState, isSyncing, syncError],
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
