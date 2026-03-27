import { NavLink, useLocation } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { GlobalSearch } from '../search/GlobalSearch';
import { average, daysBetween, formatCurrency, formatDateTime } from '../../utils/format';
import { buildVehicleInsights } from '../../utils/vehicleAnalysis';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/stock-turn', label: 'Stock Turn' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/search', label: 'Search' },
  { to: '/queue', label: 'Pricing Queue' },
  { to: '/pricing-files', label: 'Pricing Files' },
  { to: '/ai', label: 'AI Insights' },
  { to: '/admin', label: 'Admin' },
];

const SOURCE_SHORT_LABELS: Record<string, string> = {
  autoxpress: 'AX',
  carzone: 'CZ',
  carsireland: 'CI',
  donedeal: 'DD',
};

export function Sidebar() {
  const location = useLocation();
  const { activeUser, logout, vehicles, comparableListings, pricingDecisions, excludedComparables, pricingFiles, sourceHealth } =
    useAppState();
  const isDashboard = location.pathname === '/';
  const insights = isDashboard
    ? buildVehicleInsights(vehicles, comparableListings, pricingDecisions, excludedComparables, pricingFiles)
    : [];
  const averageAgeDays = Math.round(
    average(insights.map((insight) => daysBetween(insight.vehicle.stockClockStartAt ?? insight.vehicle.dateAdded))) ?? 0,
  );
  const recentDecisions = insights
    .filter((insight) => insight.decision)
    .sort((a, b) => new Date(b.decision!.decidedAt).getTime() - new Date(a.decision!.decidedAt).getTime())
    .slice(0, 3);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">AX</span>
        <div>
          <strong>AutoXpress</strong>
          <span>Pricing Intelligence</span>
        </div>
      </div>

      <GlobalSearch />

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {isDashboard ? (
        <section className="sidebar-panel">
          <div className="sidebar-panel-head">
            <strong>Dashboard signals</strong>
            <span>Quick ops snapshot</span>
          </div>

          <div className="sidebar-status-grid">
            {sourceHealth.map((source) => (
              <div className={`sidebar-status-pill is-${source.status}`} key={source.source}>
                <span>{SOURCE_SHORT_LABELS[source.source] ?? source.source}</span>
                <strong>{source.status}</strong>
              </div>
            ))}

            <div className="sidebar-status-pill">
              <span>Avg age</span>
              <strong>{averageAgeDays}d</strong>
            </div>
          </div>

          <div className="sidebar-mini-list">
            <div className="sidebar-panel-head sidebar-panel-head-compact">
              <strong>Recent decisions</strong>
            </div>

            {recentDecisions.length ? (
              recentDecisions.map((insight) => (
                <div className="sidebar-mini-item" key={insight.vehicle.id}>
                  <div>
                    <strong>{insight.vehicle.stockId}</strong>
                    <span>{insight.vehicle.make} {insight.vehicle.model}</span>
                  </div>
                  <div className="sidebar-mini-meta">
                    <strong>{formatCurrency(insight.decision!.targetPrice)}</strong>
                    <span>{formatDateTime(insight.decision!.decidedAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="sidebar-empty">No saved pricing decisions yet.</p>
            )}
          </div>
        </section>
      ) : null}

      <div className="sidebar-user">
        <div>
          <strong>{activeUser?.name}</strong>
          <span>{activeUser?.role === 'admin' ? 'Admin' : 'Pricing Manager'}</span>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            void logout();
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
