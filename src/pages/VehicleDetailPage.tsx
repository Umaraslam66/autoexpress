import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { SectionCard } from '../components/ui/SectionCard';
import { useAppState } from '../context/AppState';
import { exportPricingFileCsv } from '../utils/csv';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../utils/format';
import { computePricing, getFreshnessStatus } from '../utils/pricing';

export function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const state = useAppState();
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  const currentVehicle = vehicle ?? null;
  const [draftPrice, setDraftPrice] = useState<number | ''>('');
  const [draftNote, setDraftNote] = useState('');
  const isDemoMode = state.dataMode === 'seed';
  const currentSpec = currentVehicle?.normalizedSpec;

  const comparables = currentVehicle
    ? state.comparableListings.filter((listing) => listing.vehicleId === currentVehicle.id)
    : [];
  const excludedIds = currentVehicle ? state.excludedComparables[currentVehicle.id] ?? [] : [];
  const decision = currentVehicle ? state.pricingDecisions[currentVehicle.id] : undefined;
  const pricing = currentVehicle ? computePricing(currentVehicle, comparables, excludedIds, decision) : null;
  const sameYearComparables = pricing?.includedComparables ?? [];
  const excludedByYearCount = currentVehicle
    ? comparables.filter(
        (listing) =>
          !excludedIds.includes(listing.id) &&
          (listing.confidence === 'high' || listing.confidence === 'medium') &&
          listing.year !== currentVehicle.year,
      ).length
    : 0;

  const currentVehicleIndex = currentVehicle
    ? state.vehicles.findIndex((candidate) => candidate.id === currentVehicle.id)
    : -1;
  const previousVehicle =
    currentVehicleIndex >= 0
      ? state.vehicles[Math.max(0, currentVehicleIndex - 1)]
      : null;
  const nextVehicle =
    currentVehicleIndex >= 0
      ? state.vehicles[Math.min(state.vehicles.length - 1, currentVehicleIndex + 1)]
      : null;

  const mapSummary = useMemo(() => {
    const locations = Array.from(new Set(sameYearComparables.map((listing) => listing.dealerLocation)));
    return locations.join(', ');
  }, [sameYearComparables]);

  const recentPricingFile = currentVehicle
    ? state.pricingFiles.find((record) => record.vehicleId === currentVehicle.id)
    : null;
  const [stockTurnDate, setStockTurnDate] = useState(currentVehicle ? (currentVehicle.stockClockStartAt ?? currentVehicle.dateAdded).slice(0, 10) : '');

  useEffect(() => {
    setStockTurnDate(currentVehicle ? (currentVehicle.stockClockStartAt ?? currentVehicle.dateAdded).slice(0, 10) : '');
  }, [currentVehicle]);

  async function handleAcceptRecommendation() {
    if (!currentVehicle || !pricing?.suggestedTarget) {
      return;
    }
    await state.savePricingDecision(currentVehicle.id, {
      targetPrice: pricing.suggestedTarget,
      note: draftNote || 'Accepted system recommendation.',
      type: 'accepted',
    });
    setDraftPrice(pricing.suggestedTarget);
  }

  async function handleSaveManualDecision() {
    if (!currentVehicle || draftPrice === '' || Number.isNaN(draftPrice)) {
      return;
    }
    await state.savePricingDecision(currentVehicle.id, {
      targetPrice: Number(draftPrice),
      note: draftNote || 'Manual override applied.',
      type: 'manual',
    });
  }

  async function handleGeneratePricingFile() {
    if (!currentVehicle || !pricing) {
      return;
    }
    const record = await state.createPricingFile(currentVehicle.id);
    if (!record) {
      return;
    }
    exportPricingFileCsv(currentVehicle, pricing.includedComparables, state.pricingDecisions[currentVehicle.id], record);
  }

  async function handleSaveStockTurnDate() {
    if (!currentVehicle || !stockTurnDate) {
      return;
    }

    await state.setStockTurnDate(currentVehicle.id, {
      stockClockStartAt: `${stockTurnDate}T12:00:00.000Z`,
    });
  }

  if (!currentVehicle || !pricing) {
    return <Navigate to="/inventory" replace />;
  }

  return (
    <AppShell
      title={`${currentVehicle.make} ${currentVehicle.model}`}
      subtitle="Single-vehicle pricing review with explainable recommendation logic, historical changes, and comp-level controls."
      actions={
        <div className="action-row">
          <Link className="secondary-button" to={previousVehicle ? `/vehicle/${previousVehicle.id}` : '#'}>
            Previous
          </Link>
          <Link className="secondary-button" to={nextVehicle ? `/vehicle/${nextVehicle.id}` : '#'}>
            Next
          </Link>
          <button
            type="button"
            className="secondary-button"
            disabled={isDemoMode}
            onClick={() => {
              void state.resetStockTurn(currentVehicle.id);
            }}
          >
            Reset stock turn
          </button>
          <button type="button" className="primary-button" onClick={() => void handleGeneratePricingFile()}>
            {isDemoMode ? 'Generate pricing file (disabled)' : 'Generate pricing file'}
          </button>
        </div>
      }
    >
      <section className="vehicle-grid">
        <div className="vehicle-main-column">
          <SectionCard
            title={`${currentVehicle.stockId} • ${currentVehicle.variant}`}
            description={`${currentVehicle.year} ${currentVehicle.fuel} ${currentVehicle.transmission} ${currentVehicle.bodyType} based in ${currentVehicle.location}.`}
          >
            <div className="vehicle-hero">
              <img src={currentVehicle.imageUrl} alt={`${currentVehicle.make} ${currentVehicle.model}`} />
              <div className="vehicle-hero-meta">
                <div className="hero-price-panel">
                  <span>Current AutoXpress price</span>
                  <strong>{formatCurrency(currentVehicle.price)}</strong>
                  <p>Registration {currentVehicle.registration}</p>
                </div>
                <div className="spec-grid">
                  <div>
                    <span>Mileage</span>
                    <strong>{formatNumber(currentVehicle.mileageKm)} km</strong>
                  </div>
                  <div>
                    <span>Engine</span>
                    <strong>{currentVehicle.engineLitres.toFixed(1)}L</strong>
                  </div>
                  <div>
                    <span>Colour</span>
                    <strong>{currentVehicle.colour}</strong>
                  </div>
                  <div>
                    <span>Date added</span>
                    <strong>{formatDate(currentVehicle.dateAdded)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Market comparables"
            description={`Showing ${pricing.comparableCount} same-year comparables used in pricing. ${excludedByYearCount} off-year matches excluded.`}
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Dealer</th>
                    <th>Vehicle</th>
                    <th>Price</th>
                    <th>Days listed</th>
                    <th>Score</th>
                    <th>Freshness</th>
                    <th>Link</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sameYearComparables.map((listing) => {
                    const freshness = getFreshnessStatus(listing.lastSeenAt);
                    const isExcluded = excludedIds.includes(listing.id);

                    return (
                      <tr key={listing.id}>
                        <td>{listing.source}</td>
                        <td>
                          <strong>{listing.dealerName}</strong>
                          <span>{listing.dealerLocation}</span>
                        </td>
                        <td>
                          <strong>{listing.title}</strong>
                          <span>{listing.year} • {formatNumber(listing.mileageKm)} km</span>
                        </td>
                        <td>{formatCurrency(listing.price)}</td>
                        <td>{listing.daysListed} days</td>
                        <td>
                          <div className="table-badges">
                            <Badge tone={listing.confidence === 'high' ? 'green' : listing.confidence === 'medium' ? 'amber' : 'red'}>
                              {listing.confidence}
                            </Badge>
                            <span>{listing.matchScore}/100</span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={freshness === 'stale' ? 'red' : freshness === 'yesterday' ? 'amber' : 'green'}>
                            {freshness}
                          </Badge>
                        </td>
                        <td>
                          <a className="inline-link" href={listing.listingUrl} target="_blank" rel="noreferrer">
                            Open listing
                          </a>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isDemoMode}
                            onClick={() => {
                              void state.toggleComparable(currentVehicle.id, listing.id);
                            }}
                          >
                            {isExcluded ? 'Include' : 'Exclude'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="reason-grid">
              {sameYearComparables.map((listing) => (
                <div key={`${listing.id}-reason`} className="reason-card">
                  <strong>{listing.title}</strong>
                  <p>{listing.explanation.join(' • ')}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Activity timeline" description="Historical AutoXpress pricing actions and operator notes.">
            <div className="timeline">
              {currentVehicle.priceHistory.map((entry) => (
                <div className="timeline-item" key={entry.changedAt}>
                  <strong>{formatCurrency(entry.price)}</strong>
                  <span>{entry.changedBy}</span>
                  <span>{formatDateTime(entry.changedAt)}</span>
                </div>
              ))}
              {decision ? (
                <div className="timeline-item timeline-highlight">
                  <strong>{formatCurrency(decision.targetPrice)}</strong>
                  <span>{decision.decidedBy}</span>
                  <span>{formatDateTime(decision.decidedAt)}</span>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="vehicle-side-column">
          <SectionCard title="Pricing summary" description="Sticky recommendation panel designed for fast retail decisions.">
            <div className="summary-stack sticky-card">
              <div>
                <span>Suggested range</span>
                <strong>
                  {formatCurrency(pricing.suggestedFloor)} to {formatCurrency(pricing.suggestedCeiling)}
                </strong>
              </div>
              <div>
                <span>Suggested target</span>
                <strong>{formatCurrency(pricing.suggestedTarget)}</strong>
              </div>
              <div>
                <span>Current position</span>
                {pricing.currentPosition === 'above_market' ? (
                  <Badge tone="red">Above market</Badge>
                ) : pricing.currentPosition === 'below_market' ? (
                  <Badge tone="green">Below market</Badge>
                ) : (
                  <Badge tone="amber">In market</Badge>
                )}
              </div>
              <div>
                <span>Market map</span>
                <strong>{mapSummary || 'Location data pending'}</strong>
              </div>
              <div>
                <span>Latest pricing file</span>
                <strong>{recentPricingFile ? formatDateTime(recentPricingFile.createdAt) : 'Not generated yet'}</strong>
              </div>
              <div className="detail-panel">
                <span>Normalized spec</span>
                <strong>{currentSpec?.derivative || 'Derivative pending'}</strong>
                <p>
                  {[
                    currentSpec?.normalizedMake,
                    currentSpec?.normalizedModel,
                    currentSpec?.trim || 'No trim',
                    currentSpec?.fuelType || currentVehicle.fuel,
                    currentSpec?.transmission || currentVehicle.transmission,
                  ].filter(Boolean).join(' • ')}
                </p>
              </div>
              <div className="detail-panel">
                <span>Stock turn clock</span>
                <strong>{formatDate(currentVehicle.stockClockStartAt ?? currentVehicle.dateAdded)}</strong>
                <p>Set the live stock-turn start date if the imported start date is wrong.</p>
                <input
                  type="date"
                  value={stockTurnDate}
                  onChange={(event) => setStockTurnDate(event.target.value)}
                  disabled={isDemoMode}
                />
                <div className="stack-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleSaveStockTurnDate()}
                    disabled={isDemoMode || !stockTurnDate}
                  >
                    Save stock turn date
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      void state.resetStockTurn(currentVehicle.id);
                    }}
                    disabled={isDemoMode}
                  >
                    Reset to today
                  </button>
                </div>
              </div>

              <div className="reason-list">
                {pricing.reasoning.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
              {isDemoMode ? (
                <p className="muted-copy">This deployment is read-only. Pricing decisions and exports are not saved.</p>
              ) : null}

              <textarea
                rows={4}
                placeholder="Add pricing rationale or override note"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                disabled={isDemoMode}
              />
              <input
                type="number"
                value={draftPrice}
                onChange={(event) => setDraftPrice(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Manual target price"
                disabled={isDemoMode}
              />
              <div className="stack-actions">
                <button type="button" className="primary-button" onClick={() => void handleAcceptRecommendation()} disabled={isDemoMode}>
                  Accept recommendation
                </button>
                <button type="button" className="secondary-button" onClick={() => void handleSaveManualDecision()} disabled={isDemoMode}>
                  Save manual target
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </AppShell>
  );
}
