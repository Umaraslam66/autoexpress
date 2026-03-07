import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { formatDateTime } from '../utils/format';

export function AdminPage() {
  const state = useAppState();
  const [refreshingSource, setRefreshingSource] = useState<string | null>(null);

  async function handleRefresh(source: 'all' | 'autoxpress' | 'carzone' | 'carsireland') {
    setRefreshingSource(source);
    try {
      await state.runAdminRefresh(source);
    } finally {
      setRefreshingSource(null);
    }
  }

  return (
    <AppShell
      title="Admin"
      subtitle="Operational control surface for users, ingestion runs, source health, and normalization dictionaries."
      actions={
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={() => void handleRefresh('autoxpress')}>
            {refreshingSource === 'autoxpress' ? 'Syncing AutoXpress...' : 'Sync AutoXpress'}
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleRefresh('carzone')}>
            {refreshingSource === 'carzone' ? 'Syncing Carzone...' : 'Sync Carzone'}
          </button>
          <button type="button" className="secondary-button" onClick={() => void handleRefresh('carsireland')}>
            {refreshingSource === 'carsireland' ? 'Syncing CarsIreland...' : 'Sync CarsIreland'}
          </button>
          <button type="button" className="primary-button" onClick={() => void handleRefresh('all')}>
            {refreshingSource === 'all' ? 'Refreshing All...' : 'Refresh All Sources'}
          </button>
        </div>
      }
    >
      <section className="dashboard-grid">
        <SectionCard title="Users" description="Role-based access seed for the MVP.">
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

        <SectionCard title="Job run history" description="Background import visibility and failure context.">
          <div className="stack-list">
            {state.jobRuns.map((run) => (
              <div className="health-row" key={run.id}>
                <div>
                  <strong>{run.source}</strong>
                  <p>{run.message}</p>
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
          </div>
        </SectionCard>

        <SectionCard title="Source configuration" description="Freshness and operational health for each adapter.">
          <div className="stack-list">
            {state.sourceHealth.map((source) => (
              <div className="health-row" key={source.source}>
                <div>
                  <strong>{source.source}</strong>
                  <p>{source.message}</p>
                </div>
                <div className="health-meta">
                  <Badge tone={source.status === 'healthy' ? 'green' : source.status === 'degraded' ? 'amber' : 'red'}>
                    {source.status}
                  </Badge>
                  <span>{source.cadence}</span>
                  <span>{formatDateTime(source.lastSuccessAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Normalization dictionaries" description="Canonical mappings retained for parser traceability and match consistency.">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dictionary</th>
                  <th>Source value</th>
                  <th>Canonical value</th>
                </tr>
              </thead>
              <tbody>
                {state.normalizationRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.dictionary}</td>
                    <td>{rule.sourceValue}</td>
                    <td>{rule.canonicalValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}
