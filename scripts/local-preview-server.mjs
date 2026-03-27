import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vehicles, comparableListings, sourceHealth, jobRuns, normalizationRules, users } from '../dist-server/src/data/mockData.js';
import { buildVehicleInsights } from '../dist-server/src/utils/vehicleAnalysis.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(currentDir, '..');
const distDir = path.join(rootDir, 'dist');
const indexHtml = path.join(distDir, 'index.html');

const app = express();
app.use(express.json());

const pricingDecisions = {};
const excludedComparables = {};
const pricingFiles = [];
const currentUser = users[0];

function buildBootstrap() {
  const insights = buildVehicleInsights(
    vehicles,
    comparableListings,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
  );

  return {
    users,
    vehicles,
    comparableListings,
    sourceHealth,
    jobRuns,
    normalizationRules,
    pricingDecisions,
    excludedComparables,
    pricingFiles,
    currentUser,
    dashboard: {
      totalVehicles: vehicles.length,
      sufficientComparables: insights.filter((insight) => insight.pricing.comparableCount >= 3).length,
      needingReview: insights.filter((insight) => insight.needsReview).length,
      aboveMarket: insights.filter((insight) => insight.pricing.currentPosition === 'above_market').length,
      belowMarket: insights.filter((insight) => insight.pricing.currentPosition === 'below_market').length,
      averageDaysInStock: 0,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      mode: 'seed',
      messages: ['Local preview mode is active. Changes are served from the built frontend plus mock API data.'],
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', checkedAt: new Date().toISOString(), mode: 'preview' });
});

app.get('/api/auth/me', (_req, res) => {
  res.json({ user: currentUser });
});

app.post('/api/auth/login', (_req, res) => {
  res.json({ user: currentUser });
});

app.post('/api/auth/logout', (_req, res) => {
  res.status(204).end();
});

app.get('/api/bootstrap', (_req, res) => {
  res.json(buildBootstrap());
});

app.get('/api/vehicles/:id', (req, res) => {
  const bootstrap = buildBootstrap();
  const vehicleId = req.params.id;
  const vehicle = bootstrap.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) {
    res.status(404).json({ message: 'Vehicle not found.' });
    return;
  }
  res.json({
    vehicle,
    comparables: bootstrap.comparableListings.filter((item) => item.vehicleId === vehicleId),
    pricing: buildVehicleInsights(
      [vehicle],
      bootstrap.comparableListings.filter((item) => item.vehicleId === vehicleId),
      bootstrap.pricingDecisions,
      bootstrap.excludedComparables,
      bootstrap.pricingFiles,
    )[0]?.pricing ?? null,
    decision: bootstrap.pricingDecisions[vehicleId] ?? null,
    excludedComparableIds: bootstrap.excludedComparables[vehicleId] ?? [],
    latestPricingFile: bootstrap.pricingFiles.find((item) => item.vehicleId === vehicleId) ?? null,
  });
});

app.post('/api/vehicles/:id/stock-turn/reset', (req, res) => {
  const vehicle = vehicles.find((item) => item.id === req.params.id);
  if (!vehicle) {
    res.status(404).json({ message: 'Vehicle not found.' });
    return;
  }
  vehicle.stockClockStartAt = new Date().toISOString();
  res.json({ vehicleId: vehicle.id, stockClockStartAt: vehicle.stockClockStartAt });
});

app.post('/api/vehicles/:id/decision', (req, res) => {
  pricingDecisions[req.params.id] = {
    vehicleId: req.params.id,
    targetPrice: req.body.targetPrice,
    note: req.body.note,
    decidedBy: currentUser.name,
    decidedAt: new Date().toISOString(),
    type: req.body.type,
  };
  res.status(201).json(pricingDecisions[req.params.id]);
});

app.post('/api/vehicles/:id/exclusions', (req, res) => {
  const current = excludedComparables[req.params.id] ?? [];
  excludedComparables[req.params.id] = req.body.excluded
    ? Array.from(new Set([...current, req.body.comparableId]))
    : current.filter((id) => id !== req.body.comparableId);
  res.status(204).end();
});

app.post('/api/pricing-files', (req, res) => {
  const vehicle = vehicles.find((item) => item.id === req.body.vehicleId);
  if (!vehicle) {
    res.status(404).json({ message: 'Vehicle not found.' });
    return;
  }
  const record = {
    id: `preview-file-${pricingFiles.length + 1}`,
    vehicleId: vehicle.id,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.name,
    recommendationTarget: vehicle.price,
    finalTarget: pricingDecisions[vehicle.id]?.targetPrice ?? vehicle.price,
    note: 'Generated in local preview mode.',
    comparableCount: comparableListings.filter((item) => item.vehicleId === vehicle.id).length,
  };
  pricingFiles.unshift(record);
  res.status(201).json({ record });
});

app.post('/api/admin/refresh', (_req, res) => {
  res.json({ queued: false, messages: ['Local preview mode does not run live scraping.'] });
});

app.post('/api/admin/backfill', (_req, res) => {
  res.json({ queued: false, messages: ['Local preview mode does not run live backfill jobs.'] });
});

app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(indexHtml);
});

const port = Number.parseInt(process.env.PORT ?? '4173', 10);
app.listen(port, '127.0.0.1', () => {
  console.log(`Local preview running at http://127.0.0.1:${port}`);
});
