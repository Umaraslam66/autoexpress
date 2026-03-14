import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { KpiCard } from '../components/ui/KpiCard';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { average, daysBetween, formatCompactNumber, formatCurrency, formatDateTime } from '../utils/format';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';

export function DashboardPage() {
  const state = useAppState();
  const insights = buildVehicleInsights(
    state.vehicles,
    state.comparableListings,
    state.pricingDecisions,
    state.excludedComparables,
    state.pricingFiles,
  );

  const vehiclesNeedingReview = insights.filter((insight) => insight.needsReview);
  const aboveMarket = insights.filter((insight) => insight.pricing.currentPosition === 'above_market');
  const belowMarket = insights.filter((insight) => insight.pricing.currentPosition === 'below_market');
  const avgDaysInStock = average(insights.map((insight) => daysBetween(insight.vehicle.dateAdded))) ?? 0;
  const sufficientComps = insights.filter((insight) => insight.pricing.comparableCount >= 3);

  return (
    <AppShell
      title="Decision dashboard"
      subtitle="Prioritized stock review, live source health, and recommendation coverage across the current inventory."
      actions={
        <div className="action-row">
          <Link className="secondary-button" to="/inventory">
            Open inventory
          </Link>
          <Link className="primary-button" to="/queue">
            Review pricing queue
          </Link>
        </div>
      }
    >
      <section className="kpi-grid">
        <KpiCard label="In-stock vehicles" value={String(insights.length)} detail="Active units in the current AutoXpress inventory." />
        <KpiCard
          label="Sufficient comps"
          value={String(sufficientComps.length)}
          detail="Vehicles with at least three included comparables."
          tone="success"
        />
        <KpiCard
          label="Need review"
          value={String(vehiclesNeedingReview.length)}
          detail="Missing a decision, weak comp set, or stale market signal."
          tone="warning"
        />
        <KpiCard
          label="Above market risk"
          value={String(aboveMarket.length)}
          detail="Units currently more than 3% above target."
          tone="danger"
        />
        <KpiCard
          label="Below market"
          value={String(belowMarket.length)}
          detail="Units priced below adjusted market target."
          tone="success"
        />
        <KpiCard
          label="Avg. days in stock"
          value={formatCompactNumber(Math.round(avgDaysInStock))}
          detail="Average age of the current inventory sample."
        />
      </section>

      <section className="dashboard-grid">
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

        <SectionCard title="Source health" description="Operational view of ingestion freshness and parser quality.">
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

        <SectionCard title="Recent decisions" description="Latest saved pricing decisions and generated pricing files.">
          <div className="stack-list">
            {insights
              .filter((insight) => insight.decision)
              .sort((a, b) => new Date(b.decision!.decidedAt).getTime() - new Date(a.decision!.decidedAt).getTime())
              .slice(0, 4)
              .map((insight) => (
                <div className="decision-row" key={insight.vehicle.id}>
                  <div>
                    <strong>{insight.vehicle.stockId}</strong>
                    <p>{insight.vehicle.make} {insight.vehicle.model} {insight.vehicle.variant}</p>
                  </div>
                  <div className="decision-meta">
                    <span>{formatCurrency(insight.decision!.targetPrice)}</span>
                    <span>{insight.decision!.decidedBy}</span>
                    <span>{formatDateTime(insight.decision!.decidedAt)}</span>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>
      </section>
    </AppShell>
  );
}

