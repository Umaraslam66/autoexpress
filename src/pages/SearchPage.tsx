import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { formatCurrency, formatNumber } from '../utils/format';
import { matchesSearchTokens, normalizeVehicle } from '../utils/normalization';

export function SearchPage() {
  const state = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const trim = searchParams.get('trim') ?? '';
  const engine = searchParams.get('engine') ?? '';

  const normalizedVehicles = state.vehicles.map((vehicle) => normalizeVehicle(vehicle));
  const trims = Array.from(new Set(normalizedVehicles.map((vehicle) => vehicle.normalizedSpec?.trim).filter(Boolean))) as string[];
  const engines = Array.from(new Set(normalizedVehicles.map((vehicle) => vehicle.normalizedSpec?.engineBadge).filter(Boolean))) as string[];

  const results = normalizedVehicles.filter((vehicle) => {
    const spec = vehicle.normalizedSpec;
    const queryMatch = !query || matchesSearchTokens(spec?.searchTokens ?? [], query);
    const trimMatch = !trim || spec?.trim === trim;
    const engineMatch = !engine || spec?.engineBadge === engine;
    return queryMatch && trimMatch && engineMatch;
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  }

  return (
    <AppShell
      title="Search"
      subtitle="Normalized keyword search across make, model, trim, engine, and spec wording variants."
    >
      <SectionCard title="Search filters" description="Use free text or structured trim and engine filters.">
        <div className="filter-grid">
          <label>
            Keywords
            <input value={query} onChange={(event) => updateParam('q', event.target.value)} placeholder="Golf Comfortline TDI" />
          </label>
          <label>
            Trim
            <select value={trim} onChange={(event) => updateParam('trim', event.target.value)}>
              <option value="">All</option>
              {trims.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Engine keyword
            <select value={engine} onChange={(event) => updateParam('engine', event.target.value)}>
              <option value="">All</option>
              {engines.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Results" description={`${results.length} vehicles match the current search.`}>
        <div className="table-wrap">
          <table className="data-table dense-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Vehicle</th>
                <th>Trim</th>
                <th>Engine</th>
                <th>Mileage</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.stockId}</td>
                  <td>
                    <strong>{vehicle.make} {vehicle.model}</strong>
                    <span>{vehicle.variant}</span>
                  </td>
                  <td>{vehicle.normalizedSpec?.trim || 'N/A'}</td>
                  <td>{vehicle.normalizedSpec?.engineBadge || 'N/A'}</td>
                  <td>{formatNumber(vehicle.mileageKm)} km</td>
                  <td>{formatCurrency(vehicle.price)}</td>
                  <td>
                    <Link className="inline-link" to={`/vehicle/${vehicle.id}`}>
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
