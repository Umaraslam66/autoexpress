import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { formatCurrency } from '../utils/format';
import { getDaysInStock, getDaysSincePriceChange, getStockTurnAction } from '../utils/stockTurn';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';

export function StockTurnPage() {
  const state = useAppState();
  const insights = buildVehicleInsights(
    state.vehicles,
    state.comparableListings,
    state.pricingDecisions,
    state.excludedComparables,
    state.pricingFiles,
  );

  const stockRows = insights
    .map((insight) => {
      const daysInStock = getDaysInStock(insight.vehicle);
      const daysSincePriceChange = getDaysSincePriceChange(insight.vehicle);
      const action = getStockTurnAction({
        currentPosition: insight.pricing.currentPosition,
        daysInStock,
        daysSincePriceChange,
      });

      return {
        insight,
        daysInStock,
        daysSincePriceChange,
        action,
      };
    })
    .sort((a, b) => b.daysInStock - a.daysInStock);

  return (
    <AppShell
      title="Stock Turn"
      subtitle="Track stock age, pricing staleness, and whether each unit should be reduced or monitored."
      actions={
        <div className="action-row">
          <Link className="secondary-button" to="/">
            Decision board
          </Link>
        </div>
      }
    >
      <div className="page-tabs">
        <Link className="page-tab" to="/">
          Decision Board
        </Link>
        <Link className="page-tab page-tab-active" to="/stock-turn">
          Stock Turn
        </Link>
      </div>

      <SectionCard title="Stock turn board" description="Days in stock uses the stock clock when available, otherwise the original date added.">
        <div className="table-wrap">
          <table className="data-table dense-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Current</th>
                <th>Target</th>
                <th>Position</th>
                <th>Days in stock</th>
                <th>Days since price change</th>
                <th>Action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map(({ insight, daysInStock, daysSincePriceChange, action }) => (
                <tr key={insight.vehicle.id}>
                  <td>
                    <strong>{insight.vehicle.make} {insight.vehicle.model}</strong>
                    <span>{insight.vehicle.stockId}</span>
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
                  <td>{daysInStock}d</td>
                  <td>{daysSincePriceChange}d</td>
                  <td>
                    <Badge tone={action === 'reduce' ? 'red' : 'green'}>
                      {action === 'reduce' ? 'Reduce' : 'Monitor'}
                    </Badge>
                  </td>
                  <td>
                    <Link className="inline-link" to={`/vehicle/${insight.vehicle.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
