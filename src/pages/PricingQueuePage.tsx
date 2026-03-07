import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { formatCurrency, formatDateTime } from '../utils/format';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';

export function PricingQueuePage() {
  const state = useAppState();
  const insights = buildVehicleInsights(
    state.vehicles,
    state.comparableListings,
    state.pricingDecisions,
    state.excludedComparables,
    state.pricingFiles,
  )
    .filter((insight) => insight.needsReview)
    .sort((a, b) => b.attentionScore - a.attentionScore);

  return (
    <AppShell
      title="Pricing queue"
      subtitle="Action-first queue ranked by market risk, stale source data, and weak comparable coverage."
    >
      <SectionCard title="Actionable vehicles" description="Focused workflow for the pricing manager.">
        <div className="queue-list">
          {insights.map((insight) => (
            <article key={insight.vehicle.id} className="queue-card">
              <div className="queue-main">
                <div>
                  <p className="eyebrow">{insight.vehicle.stockId}</p>
                  <h3>{insight.vehicle.make} {insight.vehicle.model} {insight.vehicle.variant}</h3>
                  <p>
                    {insight.vehicle.year} • {insight.vehicle.fuel} • {insight.vehicle.transmission} • {insight.vehicle.location}
                  </p>
                </div>
                <div className="queue-badges">
                  <Badge tone={insight.bestConfidence === 'high' ? 'green' : insight.bestConfidence === 'medium' ? 'amber' : 'red'}>
                    {insight.bestConfidence} confidence
                  </Badge>
                  <Badge tone={insight.freshness === 'stale' ? 'red' : insight.freshness === 'yesterday' ? 'amber' : 'green'}>
                    {insight.freshness}
                  </Badge>
                </div>
              </div>

              <div className="queue-metrics">
                <div>
                  <span>Current price</span>
                  <strong>{formatCurrency(insight.vehicle.price)}</strong>
                </div>
                <div>
                  <span>Suggested target</span>
                  <strong>{formatCurrency(insight.pricing.suggestedTarget ?? insight.vehicle.price)}</strong>
                </div>
                <div>
                  <span>Final target</span>
                  <strong>{formatCurrency(insight.finalTarget)}</strong>
                </div>
                <div>
                  <span>Comparable count</span>
                  <strong>{insight.pricing.comparableCount}</strong>
                </div>
                <div>
                  <span>Latest market refresh</span>
                  <strong>{insight.latestComparableAt ? formatDateTime(insight.latestComparableAt) : 'N/A'}</strong>
                </div>
              </div>

              <div className="queue-reasons">
                {insight.pricing.reasoning.slice(0, 3).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>

              <div className="action-row">
                <Link className="primary-button" to={`/vehicle/${insight.vehicle.id}`}>
                  Review vehicle
                </Link>
                {insight.pricing.currentPosition === 'above_market' ? <Badge tone="red">Margin risk</Badge> : null}
                {insight.pricing.comparableCount < 3 ? <Badge tone="amber">Thin coverage</Badge> : null}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}

