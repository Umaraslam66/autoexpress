import type { PropsWithChildren, ReactNode } from 'react';
import { useAppState } from '../../context/AppState';
import { formatDateTime } from '../../utils/format';
import { Sidebar } from './Sidebar';

interface AppShellProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  const { dataMode, isSyncing, syncError, lastUpdatedAt, sourceMessages } = useAppState();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className={`status-banner ${syncError ? 'status-banner-error' : dataMode === 'live' ? 'status-banner-live' : ''}`}>
          <strong>{dataMode === 'live' ? 'Live scraper data' : 'Seed fallback data'}</strong>
          <span>
            {isSyncing ? 'Refreshing from source sites...' : lastUpdatedAt ? `Last sync ${formatDateTime(lastUpdatedAt)}` : 'Waiting for first sync'}
          </span>
          {sourceMessages[0] ? <span>{sourceMessages[0]}</span> : null}
          {syncError ? <span>{syncError}</span> : null}
        </div>
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
