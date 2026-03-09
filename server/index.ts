import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { computePricing } from '../src/utils/pricing.js';
import { env, hasDatabaseConfig } from './config/env.js';
import { createSessionMiddleware } from './lib/session.js';
import { HttpError, asyncHandler } from './lib/http.js';
import { getCurrentUser, loginWithPassword, logout, requireCurrentUser } from './modules/auth/service.js';
import { getBootstrapData, getVehicleDetail, listPricingFiles } from './modules/bootstrap/service.js';
import {
  createPricingDecision,
  createPricingFile,
  recomputeDealershipPricing,
  toggleComparableExclusion,
} from './modules/pricing/service.js';
import { ensureSystemSeed } from './modules/setup/service.js';
import { enqueueSourceSync, enqueueSyncAll } from './modules/jobs/queue.js';
import { syncAllSourcesNow, syncAutoXpressInventoryNow, syncMarketComparablesNow } from './modules/sources/service.js';
import { getAdminImportStatuses, getAdminJobStatuses } from './modules/admin/service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const pricingDecisionSchema = z.object({
  targetPrice: z.number().int().nonnegative(),
  note: z.string().trim().min(1).max(500),
  type: z.union([z.literal('accepted'), z.literal('manual')]),
});

const comparableExclusionSchema = z.object({
  comparableId: z.string().min(1),
  excluded: z.boolean(),
});

const refreshSchema = z.object({
  source: z.union([z.literal('all'), z.literal('autoxpress'), z.literal('carzone'), z.literal('carsireland')]),
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(currentDir, '../../dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');

async function start() {
  if (!hasDatabaseConfig()) {
    throw new Error('DATABASE_URL is required to start the AutoXpress API.');
  }

  const app = express();
  const sessionMiddleware = await createSessionMiddleware();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(sessionMiddleware);

  app.get('/api/health', asyncHandler(async (_req, res) => {
    const dealership = await ensureSystemSeed();
    res.json({
      status: 'ok',
      checkedAt: new Date().toISOString(),
      dealershipId: dealership.id,
      databaseConfigured: Boolean(env.databaseUrl),
      redisConfigured: Boolean(env.redisUrl),
    });
  }));

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await loginWithPassword(req, payload.email, payload.password);
    res.json({ user });
  }));

  app.post('/api/auth/logout', asyncHandler(async (req, res) => {
    await logout(req);
    res.status(204).end();
  }));

  app.get('/api/auth/me', asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req);
    res.json({ user });
  }));

  app.get('/api/bootstrap', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const payload = await getBootstrapData(user.id);
    res.json(payload);
  }));

  app.get('/api/dashboard', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const payload = await getBootstrapData(user.id);
    res.json(payload.dashboard);
  }));

  app.get('/api/vehicles', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const payload = await getBootstrapData(user.id);
    res.json(payload.vehicles);
  }));

  app.get('/api/vehicles/:id', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const detail = await getVehicleDetail(req.session.dealershipId ?? '', vehicleId);
    if (!detail) {
      throw new HttpError(404, 'Vehicle not found.');
    }
    const payload = await getBootstrapData(user.id);
    const comparables = payload.comparableListings.filter((listing) => listing.vehicleId === vehicleId);
    const decision = payload.pricingDecisions[vehicleId] ?? null;
    const excludedComparableIds = payload.excludedComparables[vehicleId] ?? [];
    const latestPricingFile = payload.pricingFiles.find((record) => record.vehicleId === vehicleId) ?? null;
    const pricing = computePricing(detail.vehicle, comparables, excludedComparableIds, decision);
    res.json({
      vehicle: detail.vehicle,
      comparables,
      pricing,
      decision,
      excludedComparableIds,
      latestPricingFile,
    });
  }));

  app.get('/api/vehicles/:id/comparables', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await getBootstrapData(user.id);
    res.json(payload.comparableListings.filter((listing) => listing.vehicleId === vehicleId));
  }));

  app.get('/api/vehicles/:id/pricing', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = await getBootstrapData(user.id);
    const vehicle = payload.vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) {
      throw new HttpError(404, 'Vehicle not found.');
    }
    const comparables = payload.comparableListings.filter((listing) => listing.vehicleId === vehicleId);
    const decision = payload.pricingDecisions[vehicleId];
    const excludedComparableIds = payload.excludedComparables[vehicleId] ?? [];
    const pricing = computePricing(vehicle, comparables, excludedComparableIds, decision);
    res.json({
      pricing,
      decision: decision ?? null,
      excludedComparableIds,
    });
  }));

  app.post('/api/vehicles/:id/decision', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = pricingDecisionSchema.parse(req.body);
    const decision = await createPricingDecision(req.session.dealershipId ?? '', user.id, vehicleId, payload);
    res.status(201).json(decision);
  }));

  app.post('/api/vehicles/:id/exclusions', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const vehicleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const payload = comparableExclusionSchema.parse(req.body);
    await toggleComparableExclusion(req.session.dealershipId ?? '', user.id, vehicleId, payload);
    res.status(204).end();
  }));

  app.get('/api/pricing-files', asyncHandler(async (req, res) => {
    await requireCurrentUser(req);
    const files = await listPricingFiles(req.session.dealershipId ?? '');
    res.json(files);
  }));

  app.post('/api/pricing-files', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const body = z.object({ vehicleId: z.string().min(1) }).parse(req.body);
    const record = await createPricingFile(req.session.dealershipId ?? '', user.id, body.vehicleId);
    res.status(201).json(record);
  }));

  app.get('/api/admin/jobs', asyncHandler(async (req, res) => {
    await requireCurrentUser(req);
    const statuses = await getAdminJobStatuses(req.session.dealershipId ?? '');
    res.json(statuses);
  }));

  app.get('/api/admin/sources', asyncHandler(async (req, res) => {
    await requireCurrentUser(req);
    const statuses = await getAdminImportStatuses(req.session.dealershipId ?? '');
    res.json(statuses);
  }));

  app.get('/api/admin/imports', asyncHandler(async (req, res) => {
    await requireCurrentUser(req);
    const statuses = await getAdminImportStatuses(req.session.dealershipId ?? '');
    res.json(statuses);
  }));

  app.post('/api/admin/refresh', asyncHandler(async (req, res) => {
    const user = await requireCurrentUser(req);
    const payload = refreshSchema.parse(req.body);
    const dealershipId = req.session.dealershipId ?? '';

    if (payload.source === 'all') {
      const queued = await enqueueSyncAll(dealershipId);
      if (queued) {
        res.status(202).json({ queued: true, jobId: queued.id });
        return;
      }

      const messages = await syncAllSourcesNow(dealershipId);
      res.json({ queued: false, messages, userId: user.id });
      return;
    }

    const queued = await enqueueSourceSync(dealershipId, payload.source);
    if (queued) {
      res.status(202).json({ queued: true, jobId: queued.id });
      return;
    }

    if (payload.source === 'autoxpress') {
      const result = await syncAutoXpressInventoryNow(dealershipId);
      await recomputeDealershipPricing(dealershipId);
      res.json({ queued: false, result });
      return;
    }

    const result = await syncMarketComparablesNow(dealershipId, payload.source);
    await recomputeDealershipPricing(dealershipId);
    res.json({ queued: false, result });
  }));

  app.use(express.static(frontendDistDir));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(frontendIndexPath);
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    res.status(statusCode).json({ message });
  });

  app.listen(env.port, () => {
    console.log(`AutoXpress API listening on http://127.0.0.1:${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
