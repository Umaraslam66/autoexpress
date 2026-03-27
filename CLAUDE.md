# CLAUDE.md

This file documents the current state of the AutoXpress codebase for Claude Code and other coding agents.

# AutoXpress Pricing Intelligence Platform

## Overview

- Product: internal pricing and stock-review platform for AutoXpress Ireland
- Repo branch used for active work: `main`
- Frontend: React 18 + TypeScript + Vite + React Router
- Backend: Express + TypeScript + Prisma
- Data stores: PostgreSQL + Redis
- Queue/worker: BullMQ
- Scraping: Playwright
- Deployment:
  - local dev: app processes on host, Postgres/Redis via Docker Compose
  - production/demo deploy: Railway

The application helps the dealership review live stock, compare vehicles against market listings, decide pricing, track stock turn, and export pricing files.

## Current Product Areas

- `Dashboard`
  - decision board with compact status pills in the sidebar
  - dashboard KPI cards deep-link into filtered inventory views
- `Stock Turn`
  - separate page for aging stock review
  - shows days in stock, days since price change, and action recommendation
  - stock turn clock can be reset without creating a duplicate advert
- `Inventory`
  - filterable table of stock vehicles
  - supports dashboard-driven risk filters through the URL
- `Vehicle Detail`
  - comparable listings
  - pricing recommendation
  - pricing decision workflow
  - exact-year-only market pricing
  - external comparable links
- `Search`
  - dedicated route using normalized vehicle/spec tokens
- `Pricing Files`
  - export-oriented record list
- `Admin`
  - source refresh
  - backfill trigger
  - source/job visibility
  - DoneDeal is shown only when enabled/present
- `AI`
  - AI assistant page for internal workflow support

## Important Business Logic

### Pricing bands used in the dashboard

- Green `Sufficient comps`
  - up to `EUR 300` over target and up to `10,000 km`
- Amber `Needs review`
  - `EUR 301-800` or `10,001-20,000 km`
- Red `Above market risk`
  - `EUR 801+` or `20,001+ km`

### Exact-year pricing

Pricing recommendations now use same-year comparables only.

- `computePricing()` excludes other model years from target/floor/ceiling calculations
- off-year matches can still exist as raw/matched records, but they should not drive the pricing recommendation
- vehicle detail UI should clearly communicate this when editing pricing-related screens

### Search normalization

Vehicles and comparables use normalized specs:

- `normalizedMake`
- `normalizedModel`
- `trim`
- `engineBadge`
- `fuelType`
- `transmission`
- `searchTokens[]`

Search and matching should prefer these normalized values over raw title text.

### Stock turn

Stock turn relies on:

- `stockClockStartAt`
- `lastPriceChangeAt`

Resetting stock turn is the supported workflow when a vehicle physically arrives. Do not create a duplicate vehicle record just to restart stock age.

## Source Support

Supported sources in the codebase:

- `autoxpress`
- `carzone`
- `carsireland`
- `donedeal`

Important deployment rule:

- `donedeal` is feature-gated
- `DONEDEAL_ENABLED=true` must only be used when the database/schema and runtime are ready
- Railway deploys previously failed when the app assumed `DONEDEAL` existed in the deployed enum before the database was updated
- the current code makes DoneDeal opt-in instead of default-on

## Current Deployment Modes

### 1. Demo / preview mode

Use this when you need a stable client-facing preview without live scraping.

- enable with `DEMO_MODE=true`
- backend serves curated mock/bootstrap data
- write actions are blocked
- live refresh and scraper-triggered actions are disabled
- good fit for Railway when scraper reliability is not acceptable

### 2. Live mode

Use this only when infrastructure is available:

- PostgreSQL
- Redis
- web service
- worker service
- Playwright-capable runtime

Live mode is more fragile because scraper success depends on external sites and anti-bot behavior.

## Local Development Workflow

Recommended day-to-day setup:

1. `npm run infra:up`
2. `npm run dev:server`
3. `npm run dev -- --host 127.0.0.1 --port 5173`
4. optional: `npm run dev:worker`

Why this setup:

- Postgres and Redis are stable and repeatable via Docker Compose
- frontend and API stay fast to iterate locally
- scraper debugging is easier than fully containerizing the app

### Local URLs

- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`

### Seeded local users

- `admin@autoxpress.ie` / `autoxpress`
- `pricing@autoxpress.ie` / `autoxpress`

### Login bypass for development

The login page supports two convenience paths:

- `Quick sign-in`
  - uses the seeded backend credentials
- `Preview bypass`
  - skips backend auth
  - loads local preview data
  - persists chosen preview user in `localStorage`
  - intended for development/UI review only

Bypass is enabled by default in Vite dev and can be controlled with:

- `VITE_AUTH_BYPASS_ENABLED=true|false`

Quick sign-in buttons can be controlled with:

- `VITE_QUICK_LOGIN_ENABLED=true|false`

## Environment Notes

### Backend

Important env vars:

- `DEMO_MODE`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `AUTOXPRESS_FEED_URL`
- `PORT`
- `SCRAPE_MAX_VEHICLES`
- `SCRAPE_MAX_AUTOXPRESS_PAGES`
- `SCRAPE_MAX_COMPARABLES_PER_SOURCE`
- `DONEDEAL_ENABLED`

### Frontend

Useful Vite env vars:

- `VITE_API_URL`
- `VITE_AUTH_BYPASS_ENABLED`
- `VITE_QUICK_LOGIN_ENABLED`
- `VITE_QUICK_LOGIN_ADMIN_EMAIL`
- `VITE_QUICK_LOGIN_ADMIN_PASSWORD`
- `VITE_QUICK_LOGIN_PRICING_EMAIL`
- `VITE_QUICK_LOGIN_PRICING_PASSWORD`

## Runtime / Boot Behavior

### Backend startup

- `server/config/env.ts` auto-loads `.env`
- `server/index.ts` binds to `127.0.0.1` locally, which matches the Vite proxy workflow
- health endpoint: `/api/health`

### Railway startup

The repo uses a safer web start path:

- `npm run start:web`
- backed by `scripts/start-web.mjs`

Current behavior:

- demo mode boots without trying to mutate Prisma schema
- live mode prefers `prisma migrate deploy` when migrations exist
- otherwise it falls back to `prisma db push --skip-generate`

This was added because running schema push blindly on every start was risky and caused deploy failures.

## Architecture

### Frontend

Key files:

- `src/App.tsx`
  - route definitions
  - protected routes
- `src/context/AppState.tsx`
  - global bootstrap-backed app state
  - auth/session state
  - refresh and mutation actions
  - preview bypass mode
- `src/pages/`
  - `DashboardPage.tsx`
  - `StockTurnPage.tsx`
  - `InventoryPage.tsx`
  - `SearchPage.tsx`
  - `VehicleDetailPage.tsx`
  - `PricingFilesPage.tsx`
  - `AdminPage.tsx`
  - `AIAgentPage.tsx`

The frontend follows a bootstrap pattern:

- authenticate
- fetch `/api/bootstrap`
- store the full payload in `AppState`
- derive most screens client-side from that global state

### Backend

Key files:

- `server/index.ts`
  - all primary routes
- `server/modules/bootstrap/service.ts`
  - assembles the full bootstrap payload
- `server/modules/pricing/service.ts`
  - pricing decisions, pricing files, stock-turn reset
- `server/modules/sources/service.ts`
  - source sync orchestration
- `server/modules/jobs/queue.ts`
  - BullMQ queue setup
- `server/worker.ts`
  - background worker entry

### Shared logic

- `src/utils/pricing.ts`
  - pricing algorithm
  - exact-year comparable filtering
- `src/utils/vehicleAnalysis.ts`
  - dashboard and queue insights
- `src/utils/normalization.ts`
  - normalized vehicle/spec parsing
- `src/utils/dashboardFilters.ts`
  - shared dashboard risk filter logic

## Main API Surface

Authentication:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Bootstrap:

- `GET /api/bootstrap`
- `GET /api/dashboard`

Vehicles:

- `GET /api/vehicles`
- `GET /api/vehicles/:id`
- `GET /api/vehicles/:id/comparables`
- `GET /api/vehicles/:id/pricing`
- `POST /api/vehicles/:id/decision`
- `POST /api/vehicles/:id/exclusions`
- `POST /api/vehicles/:id/stock-turn/reset`

Pricing files:

- `GET /api/pricing-files`
- `POST /api/pricing-files`

Admin:

- `GET /api/admin/jobs`
- `GET /api/admin/sources`
- `GET /api/admin/imports`
- `POST /api/admin/refresh`
- `POST /api/admin/backfill`

Health:

- `GET /api/health`

## Known Constraints and Risks

### Scraping reliability

This remains the biggest production risk.

- Railway-hosted Chromium can be blocked by Cloudflare or other anti-bot systems
- this is not solved purely by moving the same scraper to a different host
- if production reliability matters, prefer:
  - official feeds/APIs
  - CSV imports
  - licensed data feeds
  - scraper use only where operationally acceptable

### Prisma migrations

The repo currently does not rely on a mature migration history in the same way as a hardened production app.

- if client handoff becomes long-term production ownership, proper migration management should be tightened

### DoneDeal rollout

- keep `DONEDEAL_ENABLED` off until the environment is ready
- selectors and anti-bot stability should be treated as experimental

## Working Rules For Future Changes

- Prefer preserving the bootstrap-driven frontend architecture.
- Do not reintroduce broad startup-time schema mutations unless explicitly justified.
- Keep dashboard risk bands aligned with the business thresholds above.
- Keep exact-year pricing intact unless the client explicitly changes that rule.
- Treat preview/demo auth bypass as a development convenience, not a production auth strategy.
- When changing scraper behavior, consider deployment impact separately from local correctness.

## Useful Commands

- `npm run infra:up`
- `npm run infra:down`
- `npm run dev`
- `npm run dev:server`
- `npm run dev:worker`
- `npm run build`
- `npm run db:generate`
- `npm run db:push`
- `npm run db:migrate`
- `npm run db:seed`

