import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { useAppState } from '../../context/AppState';
import { formatDateTime } from '../../utils/format';
import { Sidebar } from './Sidebar';

const SOURCE_LABELS: Record<string, string> = {
  all: 'Full sync (AutoXpress + Carzone + CarsIreland)',
  autoxpress: 'AutoXpress inventory',
  carzone: 'Carzone comparables',
  carsireland: 'CarsIreland comparables',
};

const SOURCE_ESTIMATES: Record<string, string> = {
  all: '15 – 25 min',
  autoxpress: '3 – 5 min',
  carzone: '8 – 12 min',
  carsireland: '8 – 12 min',
};

function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { dataMode, isSyncing, syncError, lastUpdatedAt, scrapingSource, scrapingStartedAt, isBootstrapping, dismissError } =
    useAppState();
  const elapsed = useElapsedSeconds(scrapingStartedAt);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">

        {/* ── Scraping progress banner ── */}
        {scrapingSource ? (
          <div className="scrape-banner">
            <div className="scrape-banner-header">
              <div className="scrape-banner-pulse" />
              <strong>Scraping in progress</strong>
              <span className="scrape-banner-source">{SOURCE_LABELS[scrapingSource] ?? scrapingSource}</span>
              <span className="scrape-banner-elapsed">{formatElapsed(elapsed)}</span>
              <span className="scrape-banner-estimate">Est. {SOURCE_ESTIMATES[scrapingSource] ?? '?'}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" />
            </div>
            <p className="scrape-banner-note">Keep this tab open. Data will refresh automatically when done.</p>
          </div>
        ) : syncError ? (
          /* ── Error alert ── */
          <div className="error-alert">
            <div className="error-alert-body">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <div>
                <strong>Scrape failed</strong>
                <p>{syncError}</p>
              </div>
            </div>
            <button type="button" className="error-alert-dismiss" onClick={dismissError} aria-label="Dismiss error">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        ) : isBootstrapping ? (
          /* ── Initial connect — don't assume demo or live yet ── */
          <div className="status-banner">
            <strong>Connecting...</strong>
            <span>Loading data from the server</span>
          </div>
        ) : dataMode === 'seed' ? (
          /* ── Server confirmed read-only preview mode ── */
          <div className="status-banner status-banner-preview">
            <strong>Preview mode</strong>
            <span>This deployment uses a static dataset. Scraping and pricing decisions are disabled.</span>
          </div>
        ) : (
          /* ── Confirmed live mode ── */
          <div className="status-banner status-banner-live">
            <strong>Live data</strong>
            <span>
              {isSyncing
                ? 'Refreshing...'
                : lastUpdatedAt
                  ? `Last sync ${formatDateTime(lastUpdatedAt)}`
                  : 'Waiting for first sync'}
            </span>
          </div>
        )}

        <header className="page-head">
          <div>
            <p className="eyebrow">Internal pricing platform</p>
            <h1>{title}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>

        {children}
      </main>
    </div>
  );
}
