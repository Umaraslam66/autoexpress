import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import type { VehicleFilterState } from '../types';
import { exportInventoryCsv } from '../utils/csv';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import { buildVehicleInsights } from '../utils/vehicleAnalysis';

const defaultFilters: VehicleFilterState = {
  query: '',
  make: '',
  fuel: '',
  transmission: '',
  bodyType: '',
  priceBand: '',
  freshness: '',
  confidence: '',
};

export function InventoryPage() {
  const state = useAppState();
  const insights = buildVehicleInsights(
    state.vehicles,
    state.comparableListings,
    state.pricingDecisions,
    state.excludedComparables,
    state.pricingFiles,
  );
  const [filters, setFilters] = useState<VehicleFilterState>(defaultFilters);

  const filtered = useMemo(() => {
    return insights.filter((insight) => {
      const target = `${insight.vehicle.stockId} ${insight.vehicle.make} ${insight.vehicle.model} ${insight.vehicle.variant}`.toLowerCase();
      const queryMatch = !filters.query || target.includes(filters.query.toLowerCase());
      const makeMatch = !filters.make || insight.vehicle.make === filters.make;
      const fuelMatch = !filters.fuel || insight.vehicle.fuel === filters.fuel;
      const transmissionMatch = !filters.transmission || insight.vehicle.transmission === filters.transmission;
      const bodyTypeMatch = !filters.bodyType || insight.vehicle.bodyType === filters.bodyType;
      const freshnessMatch = !filters.freshness || insight.freshness === filters.freshness;
      const confidenceMatch = !filters.confidence || insight.bestConfidence === filters.confidence;
      const priceMatch =
        !filters.priceBand ||
        (filters.priceBand === 'sub20' && insight.vehicle.price < 20000) ||
        (filters.priceBand === '20to30' && insight.vehicle.price >= 20000 && insight.vehicle.price <= 30000) ||
        (filters.priceBand === '30plus' && insight.vehicle.price > 30000);

      return (
        queryMatch &&
        makeMatch &&
        fuelMatch &&
        transmissionMatch &&
        bodyTypeMatch &&
        freshnessMatch &&
        confidenceMatch &&
        priceMatch
      );
    });
  }, [filters, insights]);

  const makes = Array.from(new Set(state.vehicles.map((vehicle) => vehicle.make)));
  const bodyTypes = Array.from(new Set(state.vehicles.map((vehicle) => vehicle.bodyType)));

  return (
    <AppShell
      title="Inventory"
      subtitle="Dense stock view with pricing position, coverage, freshness, and direct links into single-vehicle review."
      actions={
        <button type="button" className="primary-button" onClick={() => exportInventoryCsv(filtered.map((item) => item.vehicle))}>
          Export filtered CSV
        </button>
      }
    >
      <SectionCard title="Filters" description="Filter by make, model, fuel type, or pricing position.">
        <div className="filter-grid">
          <label>
            Search
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Stock ID, make, model"
            />
          </label>
          <label>
            Make
            <select value={filters.make} onChange={(event) => setFilters((current) => ({ ...current, make: event.target.value }))}>
              <option value="">All</option>
              {makes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fuel
            <select value={filters.fuel} onChange={(event) => setFilters((current) => ({ ...current, fuel: event.target.value }))}>
              <option value="">All</option>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </label>
          <label>
            Transmission
            <select
              value={filters.transmission}
              onChange={(event) => setFilters((current) => ({ ...current, transmission: event.target.value }))}
            >
              <option value="">All</option>
              <option value="Manual">Manual</option>
              <option value="Automatic">Automatic</option>
            </select>
          </label>
          <label>
            Body type
            <select
              value={filters.bodyType}
              onChange={(event) => setFilters((current) => ({ ...current, bodyType: event.target.value }))}
            >
              <option value="">All</option>
              {bodyTypes.map((bodyType) => (
                <option key={bodyType} value={bodyType}>
                  {bodyType}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price band
            <select
              value={filters.priceBand}
              onChange={(event) => setFilters((current) => ({ ...current, priceBand: event.target.value }))}
            >
              <option value="">All</option>
              <option value="sub20">Under EUR 20k</option>
              <option value="20to30">EUR 20k to 30k</option>
              <option value="30plus">Above EUR 30k</option>
            </select>
          </label>
          <label>
            Freshness
            <select
              value={filters.freshness}
              onChange={(event) => setFilters((current) => ({ ...current, freshness: event.target.value }))}
            >
              <option value="">All</option>
              <option value="today">Refreshed today</option>
              <option value="yesterday">Refreshed yesterday</option>
              <option value="stale">Stale</option>
            </select>
          </label>
          <label>
            Match confidence
            <select
              value={filters.confidence}
              onChange={(event) => setFilters((current) => ({ ...current, confidence: event.target.value }))}
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Stock table" description={`${filtered.length} vehicles in the current filtered view.`}>
        <div className="table-wrap">
          <table className="data-table dense-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Vehicle</th>
                <th>Spec</th>
                <th>Mileage</th>
                <th>Current</th>
                <th>Target</th>
                <th>Position</th>
                <th>Comps</th>
                <th>Freshness</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((insight) => (
                <tr key={insight.vehicle.id}>
                  <td>{insight.vehicle.stockId}</td>
                  <td>
                    <strong>{insight.vehicle.make} {insight.vehicle.model}</strong>
                    <span>{insight.vehicle.registration}</span>
                  </td>
                  <td>{insight.vehicle.variant}</td>
                  <td>{formatNumber(insight.vehicle.mileageKm)} km</td>
                  <td>{formatCurrency(insight.vehicle.price)}</td>
                  <td>{formatCurrency(insight.finalTarget)}</td>
                  <td>
                    {insight.pricing.currentPosition === 'above_market' ? (
                      <Badge tone="red">Above</Badge>
                    ) : insight.pricing.currentPosition === 'below_market' ? (
                      <Badge tone="green">Below</Badge>
                    ) : (
                      <Badge tone="amber">In market</Badge>
                    )}
                  </td>
                  <td>{insight.pricing.comparableCount}</td>
                  <td>
                    <Badge tone={insight.freshness === 'stale' ? 'red' : insight.freshness === 'yesterday' ? 'amber' : 'green'}>
                      {insight.freshness}
                    </Badge>
                  </td>
                  <td>{formatDate(insight.vehicle.dateAdded)}</td>
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

