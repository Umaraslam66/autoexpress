import { AppShell } from '../components/layout/AppShell';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { exportPricingFileCsv } from '../utils/csv';
import { formatCurrency, formatDateTime } from '../utils/format';

export function PricingFilesPage() {
  const state = useAppState();
  const fileRows = state.pricingFiles
    .map((record) => {
      const vehicle = state.vehicles.find((candidate) => candidate.id === record.vehicleId);
      if (!vehicle) {
        return null;
      }

      const comparables = state.comparableListings.filter((listing) => listing.vehicleId === vehicle.id);
      const decision = state.pricingDecisions[vehicle.id];

      return {
        record,
        vehicle,
        comparables,
        decision,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!fileRows.length) {
    return (
      <AppShell title="Pricing files" subtitle="Persisted pricing evidence snapshots for one-off or batch review exports.">
        <SectionCard title="No files yet" description="Generate a pricing file from any vehicle review page to create the first exportable record.">
          <p className="muted-copy">The system stores the recommendation target, chosen target, notes, and comparable count at generation time.</p>
        </SectionCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="Pricing files" subtitle="Persisted pricing evidence snapshots for one-off or batch review exports.">
      <SectionCard title="Generated files" description={`${fileRows.length} stored pricing files in local state.`}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Vehicle</th>
                <th>Created by</th>
                <th>Created at</th>
                <th>Recommendation</th>
                <th>Final target</th>
                <th>Comparables</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fileRows.map(({ record, vehicle, comparables, decision }) => {
                return (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>
                      <strong>{vehicle.stockId}</strong>
                      <span>{vehicle.make} {vehicle.model} {vehicle.variant}</span>
                    </td>
                    <td>{record.createdBy}</td>
                    <td>{formatDateTime(record.createdAt)}</td>
                    <td>{formatCurrency(record.recommendationTarget)}</td>
                    <td>{formatCurrency(record.finalTarget)}</td>
                    <td>{record.comparableCount}</td>
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => exportPricingFileCsv(vehicle, comparables, decision, record)}
                      >
                        Export CSV
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AppShell>
  );
}
