import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { KpiCard } from '../components/ui/KpiCard';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { formatCurrency } from '../utils/format';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';
import { matchesDashboardVehicleFilter } from '../utils/dashboardFilters';

export function DashboardPage() {
  const state = useAppState();
  const insights = buildVehicleInsights(
    state.vehicles,
    state.comparableListings,
    state.pricingDecisions,
    state.excludedComparables,
    state.pricingFiles,
  );

  const marketAligned = insights.filter((insight) => matchesDashboardVehicleFilter(insight, 'market_aligned'));
  const vehiclesNeedingReview = insights.filter((insight) => matchesDashboardVehicleFilter(insight, 'need_review'));
  const aboveMarket = insights.filter((insight) => matchesDashboardVehicleFilter(insight, 'above_market'));
  const belowMarket = insights.filter((insight) => insight.pricing.currentPosition === 'below_market');

  return (
    <AppShell
      title="Decision dashboard"
      subtitle="Prioritized stock review and market-risk coverage across the current inventory."
      actions={
        <div className="action-row">
          <Link className="secondary-button" to="/stock-turn">
            Open stock turn
          </Link>
          <Link className="secondary-button" to="/inventory">
            Open inventory
          </Link>
          <Link className="primary-button" to="/queue">
            Review pricing queue
          </Link>
        </div>
      }
    >
      <div className="page-tabs">
        <Link className="page-tab page-tab-active" to="/">
          Decision Board
        </Link>
        <Link className="page-tab" to="/stock-turn">
          Stock Turn
        </Link>
      </div>

      <section className="kpi-grid">
        <KpiCard
          label="In-stock vehicles"
          value={String(insights.length)}
          detail="Active units in the current AutoXpress inventory."
          to="/inventory?dashboardFilter=all"
        />
        <KpiCard
          label="Market aligned"
          value={String(marketAligned.length)}
          detail="Up to EUR 300 over target and up to 10,000km from comp median."
          tone="success"
          to="/inventory?dashboardFilter=market_aligned"
        />
        <KpiCard
          label="Need review"
          value={String(vehiclesNeedingReview.length)}
          detail="EUR 301-800 over target or 10,001-20,000km from comp median."
          tone="warning"
          to="/inventory?dashboardFilter=need_review"
        />
        <KpiCard
          label="Above market risk"
          value={String(aboveMarket.length)}
          detail="EUR 801+ over target or 20,001km+ from comp median."
          tone="danger"
          to="/inventory?dashboardFilter=above_market"
        />
        <KpiCard
          label="Below market"
          value={String(belowMarket.length)}
          detail="Units priced below adjusted market target."
          tone="success"
          to="/inventory?dashboardFilter=below_market"
        />
      </section>

      <section className="dashboard-main">
        <SectionCard
          title="Priority queue"
          description="Highest-attention vehicles based on pricing risk, freshness, and recommendation coverage."
          action={<Link className="ghost-button" to="/queue">Open full queue</Link>}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Current</th>
                  <th>Target</th>
                  <th>Position</th>
                  <th>Freshness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {insights
                  .slice()
                  .sort((a, b) => b.attentionScore - a.attentionScore)
                  .slice(0, 5)
                  .map((insight) => (
                    <tr key={insight.vehicle.id}>
                      <td>
                        <strong>{insight.vehicle.make} {insight.vehicle.model}</strong>
                        <span>{insight.vehicle.variant}</span>
                      </td>
                      <td>{formatCurrency(insight.vehicle.price)}</td>
                      <td>{formatCurrency(insight.finalTarget)}</td>
                      <td>
                        {insight.pricing.currentPosition === 'above_market' ? (
                          <Badge tone="red">Above market</Badge>
                        ) : insight.pricing.currentPosition === 'below_market' ? (
                          <Badge tone="green">Below market</Badge>
                        ) : (
                          <Badge tone="amber">In market</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={insight.freshness === 'stale' ? 'red' : insight.freshness === 'yesterday' ? 'amber' : 'green'}>
                          {insight.freshness}
                        </Badge>
                      </td>
                      <td>
                        <Link className="inline-link" to={`/vehicle/${insight.vehicle.id}`}>
                          Review
                        </Link>
                      </td>
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
