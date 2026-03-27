import { useAppState } from '../context/AppState';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { formatDateTime } from '../utils/format';

const SOURCE_LABELS: Record<string, string> = {
  all: 'All sources',
  autoxpress: 'AutoXpress',
  carzone: 'Carzone',
  carsireland: 'CarsIreland',
  donedeal: 'DoneDeal',
};

export function AdminPage() {
  const state = useAppState();
  const isDemoMode = state.dataMode === 'seed';
  const isScrapingActive = state.scrapingSource !== null;
  const doneDealAvailable =
    isDemoMode ||
    state.sourceHealth.some((source) => source.source === 'donedeal') ||
    state.jobRuns.some((run) => run.source === 'donedeal');

  async function handleRefresh(source: 'all' | 'autoxpress' | 'carzone' | 'carsireland' | 'donedeal') {
    await state.runAdminRefresh(source);
  }

  return (
    <AppShell
      title="Admin"
      subtitle="Trigger scrapes, view job history, and check source health."
    >
      {isDemoMode ? (
        <div className="info-banner">
          <strong>Demo mode</strong> — scraping is disabled. Source health and job history below are sample records.
        </div>
      ) : null}

      <section className="admin-grid">

        {/* ── Scraper controls ── */}
        <SectionCard
          title="Scraper controls"
          description="Each button triggers a live browser scrape. The full sync can take 15–25 minutes."
        >
          <div className="scraper-control-list">

            <div className="scraper-control-row">
              <div>
                <strong>AutoXpress inventory</strong>
                <p>Re-scrapes autoxpress.ie and updates vehicle stock. Takes 3–5 min.</p>
              </div>
              <button
                type="button"
                className={`secondary-button ${state.scrapingSource === 'autoxpress' ? 'is-active-scrape' : ''}`}
                onClick={() => void handleRefresh('autoxpress')}
                disabled={isDemoMode || isScrapingActive}
              >
                {state.scrapingSource === 'autoxpress' ? 'Running...' : 'Sync inventory'}
              </button>
            </div>

            <div className="scraper-control-row">
              <div>
                <strong>Carzone comparables</strong>
                <p>Fetches competitor listings from carzone.ie for all makes. Takes 8–12 min.</p>
              </div>
              <button
                type="button"
                className={`secondary-button ${state.scrapingSource === 'carzone' ? 'is-active-scrape' : ''}`}
                onClick={() => void handleRefresh('carzone')}
                disabled={isDemoMode || isScrapingActive}
              >
                {state.scrapingSource === 'carzone' ? 'Running...' : 'Sync Carzone'}
              </button>
            </div>

            <div className="scraper-control-row">
              <div>
                <strong>CarsIreland comparables</strong>
                <p>Fetches competitor listings from carsireland.ie for all makes. Takes 8–12 min.</p>
              </div>
              <button
                type="button"
                className={`secondary-button ${state.scrapingSource === 'carsireland' ? 'is-active-scrape' : ''}`}
                onClick={() => void handleRefresh('carsireland')}
                disabled={isDemoMode || isScrapingActive}
              >
                {state.scrapingSource === 'carsireland' ? 'Running...' : 'Sync CarsIreland'}
              </button>
            </div>

            {doneDealAvailable ? (
              <div className="scraper-control-row">
                <div>
                  <strong>DoneDeal comparables</strong>
                  <p>Fetches competitor listings from donedeal.ie for all makes. Use this only when the source is enabled.</p>
                </div>
                <button
                  type="button"
                  className={`secondary-button ${state.scrapingSource === 'donedeal' ? 'is-active-scrape' : ''}`}
                  onClick={() => void handleRefresh('donedeal')}
                  disabled={isDemoMode || isScrapingActive}
                >
                  {state.scrapingSource === 'donedeal' ? 'Running...' : 'Sync DoneDeal'}
                </button>
              </div>
            ) : null}

            <div className="scraper-control-row scraper-control-row--primary">
              <div>
                <strong>Full sync</strong>
                <p>Runs inventory plus all comparable sources in sequence and recomputes pricing recommendations.</p>
              </div>
              <button
                type="button"
                className={`primary-button ${state.scrapingSource === 'all' ? 'is-active-scrape' : ''}`}
                onClick={() => void handleRefresh('all')}
                disabled={isDemoMode || isScrapingActive}
              >
                {state.scrapingSource === 'all' ? 'Running full sync...' : 'Full sync'}
              </button>
            </div>

            <div className="scraper-control-row">
              <div>
                <strong>Rebuild pricing dataset</strong>
                <p>Re-runs inventory sync, comparable syncs, and pricing recomputation after normalization or algorithm changes.</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void state.runAdminBackfill()}
                disabled={isDemoMode || isScrapingActive}
              >
                Rebuild dataset
              </button>
            </div>

          </div>
        </SectionCard>

        {/* ── Source health ── */}
        <SectionCard title="Source health" description="Last known status for each scraping adapter.">
          <div className="stack-list">
            {state.sourceHealth.map((source) => {
              const isThisRunning = state.scrapingSource === source.source.toLowerCase() || state.scrapingSource === 'all';
              return (
                <div className="health-row" key={source.source}>
                  <div>
                    <strong>{source.source}</strong>
                    <p>{isThisRunning ? 'Scraping now...' : (source.message || '—')}</p>
                  </div>
                  <div className="health-meta">
                    <Badge
                      tone={
                        isThisRunning ? 'blue'
                        : source.status === 'healthy' ? 'green'
                        : source.status === 'degraded' ? 'amber'
                        : 'red'
                      }
                    >
                      {isThisRunning ? 'running' : source.status}
                    </Badge>
                    <span>{source.cadence}</span>
                    <span>{formatDateTime(source.lastSuccessAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── Job history ── */}
        <SectionCard title="Job history" description="Results from the last 20 scrape runs.">
          <div className="stack-list">
            {state.jobRuns.slice(0, 20).map((run) => (
              <div className="health-row" key={run.id}>
                <div>
                  <strong>
                    {SOURCE_LABELS[run.source.toLowerCase()] ?? run.source}
                  </strong>
                  <p>{run.message || '—'}</p>
                </div>
                <div className="health-meta">
                  <Badge tone={run.status === 'success' ? 'green' : run.status === 'warning' ? 'amber' : 'red'}>
                    {run.status}
                  </Badge>
                  <span>{run.recordsProcessed} records</span>
                  <span>{formatDateTime(run.completedAt)}</span>
                </div>
              </div>
            ))}
            {state.jobRuns.length === 0 ? (
              <p className="muted-copy">No jobs have run yet.</p>
            ) : null}
          </div>
        </SectionCard>

        {/* ── Users ── */}
        <SectionCard title="Users" description="Role-based access for this workspace.">
          <div className="stack-list">
            {state.users.map((user) => (
              <div className="health-row" key={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <p>{user.email}</p>
                </div>
                <Badge tone={user.role === 'admin' ? 'blue' : 'green'}>{user.role}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>

      </section>
    </AppShell>
  );
}
