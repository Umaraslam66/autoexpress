# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AutoXpress Pricing Intelligence Platform

## Project Overview

**Product:** AutoXpress Pricing Intelligence Platform
**Type:** Internal web-based pricing tool (future SaaS potential)
**Purpose:** Automate competitive pricing analysis for a used car dealership
**Client:** AutoXpress Ireland (400+ vehicle inventory)
**Status:** Production-ready, all scrapers operational, 100% data coverage
**Active branch for current work:** `feat/scraper-perf-optimisation` (do not merge to `main` without client sign-off — Railway deploys from `main`)

### The Problem
AutoXpress manually checks pricing across competitor websites (carzone.ie, carsireland.ie), which is time-consuming, inconsistent, and leaves no audit trail. This platform replaces that manual process entirely.

### The Solution
1. Scrapes AutoXpress's own inventory from autoxpress.ie
2. Scrapes comparable listings from Carzone and CarsIreland
3. Matches vehicles using an intelligent scoring algorithm
4. Generates data-driven pricing recommendations
5. Allows user decisions with full history and audit trail
6. Exports pricing files for operations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js 20, Express 4, TypeScript |
| ORM | Prisma with PostgreSQL |
| Job Queue | BullMQ + Redis |
| Scraping | Playwright (headless Chromium) |
| Auth | express-session + bcryptjs |
| Infra | Docker Compose (local), Railway.app (production) |

---

## Architecture

```
Frontend (React SPA)
       │ REST API calls (/api/*)
       ▼
Express API Server (server/index.ts)
   ├── Auth (/api/auth/*)
   ├── Vehicles (/api/vehicles/*)
   ├── Admin (/api/admin/*)
   └── Bootstrap (/api/bootstrap)
       │
       ├──── PostgreSQL (via Prisma)
       ├──── Redis (sessions + BullMQ queue)
       └──── Background Worker (server/worker.ts)
                  │ Playwright
                  ▼
         ┌────────────────────────────┐
         │  autoxpress.ie (inventory) │
         │  carzone.ie (comparables)  │
         │  carsireland.ie (comps)    │
         └────────────────────────────┘
```

**Key architectural decision:** Bootstrap pattern — the frontend fetches all data in a single `/api/bootstrap` call on login and stores it in a global React context. All pages work from this in-memory state and refetch on mutations.

---

## Project Structure

```
autoexpress/
├── src/                          # Frontend
│   ├── App.tsx                   # Route definitions (protected + public)
│   ├── main.tsx                  # Entry point, wraps with BrowserRouter + AppStateProvider
│   ├── config.ts                 # API_URL config (VITE_API_URL env or '')
│   ├── types.ts                  # All TypeScript interfaces
│   ├── context/AppState.tsx      # Global state — ALL data lives here, including
│   │                             #   scrapingSource, scrapingStartedAt, isBootstrapping
│   ├── pages/
│   │   ├── LoginPage.tsx         # Auth — empty fields, no credential hints
│   │   ├── DashboardPage.tsx     # KPIs, priority queue, source health
│   │   ├── InventoryPage.tsx     # Filterable vehicle table + CSV export
│   │   ├── VehicleDetailPage.tsx # Comparables, pricing recommendation, decision form
│   │   ├── PricingQueuePage.tsx  # Vehicles needing pricing attention
│   │   ├── PricingFilesPage.tsx  # Generated pricing records
│   │   └── AdminPage.tsx         # Scraping triggers with descriptions + estimates,
│   │                             #   job history, source health, users
│   ├── components/
│   │   ├── layout/AppShell.tsx   # Page wrapper; top banner has 3 states:
│   │   │                         #   Connecting… / Preview mode / Live data
│   │   │                         #   + scraping progress banner + dismissible error alert
│   │   ├── layout/Sidebar.tsx    # Navigation + user profile
│   │   └── ui/                   # Badge, KpiCard, SectionCard
│   └── utils/
│       ├── pricing.ts            # computePricing() — core pricing algorithm
│       ├── vehicleAnalysis.ts    # buildVehicleInsights() — attention scores
│       ├── csv.ts                # CSV export helpers
│       └── format.ts             # Currency/date/number formatters
│
├── server/                       # Backend
│   ├── index.ts                  # Express app, all routes, middleware
│   ├── worker.ts                 # BullMQ worker entry point
│   ├── config/
│   │   ├── env.ts               # Environment variable parsing
│   │   └── defaults.ts          # DEFAULT_USERS, normalization rules
│   ├── lib/
│   │   ├── prisma.ts            # Singleton Prisma client
│   │   ├── redis.ts             # BullMQ + session Redis clients
│   │   ├── browser.ts           # Playwright browser pool + retry logic
│   │   ├── parse.ts             # parseCurrency, parseYear, slugify, etc.
│   │   ├── auth.ts              # bcrypt helpers
│   │   ├── http.ts              # HTTP error wrapper
│   │   ├── matching.ts          # scoreComparable() algorithm
│   │   └── session.ts           # express-session middleware
│   └── modules/
│       ├── auth/service.ts      # loginWithPassword, logout, getCurrentUser
│       ├── bootstrap/service.ts # getBootstrapData() — main data aggregator
│       ├── pricing/service.ts   # createPricingDecision, toggleExclusion
│       ├── admin/service.ts     # Admin queries
│       ├── setup/service.ts     # DB seeding
│       ├── jobs/
│       │   ├── queue.ts         # BullMQ queue + recurring job registration
│       │   └── worker.ts        # Job processors
│       ├── sources/
│       │   ├── service.ts       # PRIMARY sync orchestration — used by worker + API.
│       │   │                    #   syncComparableSource() groups vehicles by make/model,
│       │   │                    #   scrapes once per group, scores per vehicle.
│       │   ├── service-parallel.ts  # Thin re-export of service.ts (legacy entry point)
│       │   └── adapters/        # Source-specific wrappers (legacy per-vehicle path)
│       └── shared/mappers.ts    # DTOs: toVehicleDto, toComparableListingDto
│
├── server/scrapers/              # Playwright scraper implementations
│   ├── rawTypes.ts              # RawScrapedListing — un-scored listing shared across
│   │                            #   all vehicles of the same make/model
│   ├── autoxpress.ts            # Two-pass: list pages → detail pages
│   ├── carzone.ts               # scrapeCarzoneMakeModel(make, model) → RawScrapedListing[]
│   │                            #   + legacy scrapeCarzoneComparables(vehicle) kept as fallback
│   └── carsIreland.ts           # scrapeCarsIrelandMakeModel(make, model) → RawScrapedListing[]
│                                #   + legacy scrapeCarsIrelandComparables(vehicle)
│
├── prisma/
│   ├── schema.prisma            # 14-table database schema
│   └── seed.ts                  # Default dealership, users, sources
│
└── Config files
    ├── package.json             # Scripts and dependencies
    ├── docker-compose.yml       # PostgreSQL:16 + Redis:7
    ├── vite.config.ts           # Dev proxy: /api → :8000
    ├── tsconfig.json            # Frontend TS (target: ES2020)
    ├── tsconfig.server.json     # Backend TS (target: ES2022, NodeNext)
    ├── railway.json             # Railway deployment
    └── Procfile                 # web + worker service definitions
```

---

## Database Schema (14 Tables)

```
Dealership          → id, name, slug
User                → id, dealershipId, name, email, role, passwordHash
SessionRecord       → id, sid, userId, expiresAt
InventorySource     → id, dealershipId, source, mode, enabled, priority
SourceRun           → id, dealershipId, source, mode, status, startedAt, completedAt, recordsProcessed
Vehicle             → id, dealershipId, make, model, variant, year, mileageKm, fuel,
                      transmission, bodyType, engineLitres, colour, price, status,
                      dateAdded, location, vehicleUrl, imageUrl
VehicleSnapshot     → id, vehicleId, price, mileageKm, status, capturedAt
RawListing          → id, source, kind (INVENTORY|COMPARABLE), payloadJson, htmlSnapshot
NormalizedListing   → id, source, make, model, year, mileageKm, fuel, transmission,
                      price, dealerName, dealerLocation, daysListed
VehicleMatch        → id, vehicleId, normalizedListingId, score, confidence, included, manuallyExcluded
ExcludedComparable  → id, vehicleId, normalizedListingId, userId
PricingRecommendation → id, vehicleId, comparableCount, marketMin/Max/Median/Average,
                        suggestedFloor/Target/Ceiling, currentPosition, deltaToTargetPct
PricingDecision     → id, vehicleId, userId, targetPrice, note, type (ACCEPTED|MANUAL), decidedAt
PricingFile         → id, vehicleId, userId, recommendationTarget, finalTarget, note
NormalizationRule   → id, dictionary, sourceValue, canonicalValue
```

**Enum values:**
- `Vehicle.status`: `ACTIVE | SOLD | INCOMING`
- `VehicleMatch.confidence`: `HIGH | MEDIUM | LOW`
- `PricingDecision.type`: `ACCEPTED | MANUAL`
- `InventorySource.source`: `AUTOXPRESS | CARZONE | CARSIRELAND`
- `InventorySource.mode`: `FEED | SCRAPE | CSV`

---

## API Routes

All routes require authentication (session cookie) except login.

```
POST   /api/auth/login                   loginWithPassword()
POST   /api/auth/logout                  logout()
GET    /api/auth/me                      getCurrentUser()

GET    /api/bootstrap                    getBootstrapData() ← primary data endpoint
GET    /api/dashboard                    Dashboard stats summary
GET    /api/vehicles                     All vehicles list
GET    /api/vehicles/:id                 Single vehicle detail
GET    /api/vehicles/:id/comparables     Comparables for vehicle
GET    /api/vehicles/:id/pricing         Pricing recommendation
POST   /api/vehicles/:id/decision        Create pricing decision
POST   /api/vehicles/:id/exclusions      Toggle comparable exclusion

GET    /api/pricing-files                List pricing files
POST   /api/pricing-files               Generate pricing file

GET    /api/admin/jobs                   Job run history
GET    /api/admin/sources               Source health status
GET    /api/admin/imports               Import statuses
POST   /api/admin/refresh               Trigger scraping { source: 'all'|'autoxpress'|'carzone'|'carsireland' }

GET    /api/health                       Health check
GET    /                                 Serves frontend (dist/index.html)
```

---

## Frontend Data Flow

### Bootstrap (on login)
```
POST /api/auth/login
  → Creates session, returns AppUser
GET /api/bootstrap
  → Returns ALL data: vehicles, comparables, matches, decisions,
    exclusions, pricingFiles, users, jobRuns, sourceHealth, normRules
  → AppStateProvider populates global context
  → All pages render from this in-memory state
```

### AppState banner states
The top banner in AppShell has three distinct states driven by `isBootstrapping` and `dataMode`:
```
isBootstrapping=true          → "Connecting…"  (neutral, before first fetch settles)
dataMode='seed'               → "Preview mode" (amber, server confirmed DEMO_MODE=true)
dataMode='live'               → "Live data"    (green, normal operating state)
scrapingSource !== null       → scraping progress banner with animated bar + elapsed timer
syncError !== null            → dismissible red error alert
```

### Manual Scrape Trigger
```
POST /api/admin/refresh { source: 'all' }
  → HTTP call held open for full scrape duration (18–25 min for full sync)
  → AppState sets scrapingSource + scrapingStartedAt → progress banner appears
  → scrapeAutoXpress → scrapeCarzone (deduplicated) → scrapeCarsIreland (deduplicated)
  → Creates VehicleMatches, PricingRecommendations
GET /api/bootstrap ← refetch on completion
```

---

## Core Algorithms

### Matching Algorithm (`server/lib/matching.ts`)

```
Score per comparable:
  +28   make matches
  +28   model matches
  +16   year exact, scaling down to 0 for 4+ year diff
  +12   mileage within 15k km
  + 6   mileage within 40k km
  + 8   fuel matches
  + 6   transmission matches
  + 4   body type matches
  + 3   per variant keyword match (max 8)
  + 6   price within 12%

Confidence:
  HIGH   → score ≥ 72
  MEDIUM → score ≥ 52
  LOW    → score < 52
```

### Pricing Algorithm (`src/utils/pricing.ts`)

```
1. Filter: Keep only HIGH + MEDIUM confidence matches
2. Remove manually excluded comparables
3. Filter outliers: price ±18%, mileage ±80k km, year ±3
4. Apply weighted adjustments per comparable:
   - Mileage:  +€35 per 1,000 km difference
   - Year:     +€420 per year newer
   - Age:      -€120 if listed > 30 days
5. Confidence weight: HIGH=1.0, MEDIUM=0.65
6. Calculate weighted market stats (min/max/median/average)
7. Target = weighted median
8. Floor  = target - €750
9. Ceiling = target + €900

Position determination:
  BELOW  → current price < target - 3%
  IN     → within ±3% of target
  ABOVE  → current price > target + 3%
```

### Attention Score (`src/utils/vehicleAnalysis.ts`)

```
+35  price is ABOVE market
+10  price is BELOW market
+30  comparables are stale (not today or yesterday)
+15  comparables from yesterday only
+20  fewer than 3 comparables
+ 8  fewer than 5 comparables
+12  no pricing decision made

Needs review if: attentionScore ≥ 20 OR no decision
```

---

## Scraping Implementation

### AutoXpress (Two-Pass)
- **URL:** `https://www.autoxpress.ie/search`
- **Pass 1:** Paginate through all listing pages, collect vehicle URLs + basic data
- **Pass 2:** Visit each vehicle detail page for colour, registration, full specs
- **Critical fix:** Uses string-based `page.evaluate()` (not function serialization) to avoid tsx `__name` transpilation error

### Carzone & CarsIreland — Deduplicated Parallel Scraping

**Old approach (per-vehicle):** 489 vehicles × 2 sources = 978 browser sessions → ~110 minutes

**New approach (per make/model group):**
```
Active vehicles (489)
  → grouped by (make, model) → ~80–92 unique groups

For each group (4 concurrent):
  scrapeCarzoneMakeModel(make, model) → RawScrapedListing[] (≤50 raw results)

  For each vehicle in the group:
    rawToComparable(vehicle, raw) → score each listing
    .sort(matchScore desc).slice(0, maxComparablesPerSource)
    → persist VehicleMatch records
```

~80 groups × 2 sources = **~160 browser sessions → ~18 minutes**. Match quality unchanged.

**Key files:**
- `server/scrapers/rawTypes.ts` — `RawScrapedListing` type (no vehicleId, no score)
- `server/scrapers/carzone.ts` — `scrapeCarzoneMakeModel(make, model)` (new) + legacy fn
- `server/scrapers/carsIreland.ts` — `scrapeCarsIrelandMakeModel(make, model)` (new) + legacy fn
- `server/modules/sources/service.ts` — `syncComparableSource()` contains the grouping + `runWithConcurrency(4)` logic

**CarsIreland bug fixes (still in place):**
- Price: extract first text node only (prevents "€14,950 Per Month" → €14,950,503)
- Fuel/transmission: `parseFuelAndTransmission()` helper — TDI→Diesel, TSI→Petrol, PHEV→Hybrid, automatic/DSG/S-tronic detection

### Playwright Configuration
- Headless Chromium, singleton browser instance
- User agent: Chrome 126 on macOS (anti-bot)
- Viewport: 1440x1200
- Retry: 3x on transient network errors
- `withBrowserContext(fn)` wrapper in `server/lib/browser.ts` — creates/closes a context per call

---

## Authentication & Sessions

### Modes
- **Live mode** (`DEMO_MODE=false`, default): Bcrypt verification, SessionRecord in DB
- **Preview mode** (`DEMO_MODE=true`): Hardcoded users, no DB writes, read-only — used for client review deployments with static data

### Default Users (after seeding)
| Email | Password | Role |
|---|---|---|
| `admin@autoxpress.ie` | `autoxpress` | ADMIN |
| `pricing@autoxpress.ie` | `autoxpress` | PRICING_MANAGER |

### Session Storage
- Redis if `REDIS_URL` configured
- In-memory fallback if no Redis (sessions lost on restart)

---

## Environment Variables

```env
# Core
NODE_ENV=development
PORT=8000
SESSION_SECRET=your-secret-here
DEMO_MODE=false          # Set true for read-only client-review deployments

# Database
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/autoxpress

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Scraping (testing)
SCRAPE_MAX_VEHICLES=8
SCRAPE_MAX_AUTOXPRESS_PAGES=2
SCRAPE_MAX_COMPARABLES_PER_SOURCE=4

# Scraping (production)
SCRAPE_MAX_VEHICLES=500
SCRAPE_MAX_AUTOXPRESS_PAGES=50
SCRAPE_MAX_COMPARABLES_PER_SOURCE=15   # Per vehicle, after scoring the raw pool

# Optional
AUTOXPRESS_FEED_URL=
BOOTSTRAP_CACHE_TTL_MS=300000
```

---

## Local Development

### Prerequisites
- Node.js 20+
- Docker + Docker Compose

### Setup
```bash
git clone https://github.com/Umaraslam66/autoexpress.git
cd autoexpress
npm install

cp .env.example .env
# Edit .env if needed

docker-compose up -d        # Start PostgreSQL + Redis
npm run db:generate         # Generate Prisma client
npm run db:push             # Create tables
npm run db:seed             # Seed default data
```

### Running
```bash
# Terminal 1 - Backend API (env vars must be passed explicitly)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/autoxpress" \
REDIS_URL="redis://127.0.0.1:6379" \
npm run dev:server

# Terminal 2 - Background Worker
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/autoxpress" \
REDIS_URL="redis://127.0.0.1:6379" \
npm run dev:worker

# Terminal 3 - Frontend
npm run dev
```

### Access
- **Frontend:** http://localhost:5173 (or 5174 if port taken)
- **Backend API:** http://localhost:8000
- **Login:** `admin@autoxpress.ie` / `autoxpress`

### npm Scripts
```bash
npm run dev              # Vite frontend dev server
npm run dev:server       # Backend API with hot reload (tsx watch)
npm run dev:worker       # Background worker with hot reload
npm run build            # Production build: prisma generate + tsc (frontend) + tsc (server) + vite build + playwright install chromium
npm run start            # Run production API (dist-server/server/index.js)
npm run start:web        # Railway production: db push --accept-data-loss then start API
npm run start:worker     # Run production worker
npm run db:generate      # prisma generate
npm run db:push          # prisma db push
npm run db:migrate       # prisma migrate deploy
npm run db:seed          # tsx prisma/seed.ts
```

### Type Checking
```bash
npx tsc --noEmit                           # Check frontend TypeScript
npx tsc -p tsconfig.server.json --noEmit   # Check backend TypeScript
```

> There are no tests and no ESLint configured in this project.

---

## Production (Railway)

### Services
- **web** — Express API + static frontend
- **worker** — Background job processor
- **PostgreSQL** — Managed database
- **Redis** — Job queue + sessions

### Deployment
1. Push to GitHub (`main` branch)
2. Railway auto-deploys from `main`
3. See `DEPLOYMENT.md` for full setup

### Railway Config
- `railway.json` — Build config
- `nixpacks.toml` — Nixpacks build settings
- `Procfile` — `web: node dist-server/index.js` and `worker: node dist-server/worker.js`

### Deployment modes
- **Production** (`DEMO_MODE=false`): full live scraping, real DB, pricing decisions enabled
- **Client preview** (`DEMO_MODE=true`): static compressed DB, all write actions blocked, banner says "Preview mode"

---

## Background Jobs (BullMQ)

Queue name: `autoxpress-ingestion`

### Job Types
| Job | Schedule | What it does |
|---|---|---|
| `repeat-autoxpress` | Every 4 hours | Scrape AutoXpress inventory |
| `repeat-carzone` | Every 12 hours | Scrape Carzone comparables (deduplicated) |
| `repeat-carsireland` | Every 12 hours | Scrape CarsIreland comparables (deduplicated) |
| `sync-all` | Manual trigger | All three scrapers + pricing recompute |
| `sync-source` | Manual trigger | Single source scrape |

Jobs are registered via `registerRecurringJobs()` called on worker startup.

If Redis is unavailable, scraping falls back to synchronous execution in the API request.

---

## Known Issues & Fixes

### Fixed
- **Playwright tsx transpilation:** `page.evaluate()` uses string-based eval, not function serialization
- **AutoXpress incomplete coverage:** Two-pass approach captures 100% of vehicles
- **CarsIreland price corruption:** Extract first text node only
- **CarsIreland missing fuel/transmission:** `parseFuelAndTransmission()` helper
- **Sequential scraping (82h bottleneck):** Deduplicated parallel scraping → ~18 minutes
- **SourceRun healthStatus crash:** Removed non-existent field from schema
- **"Demo data" flash on every page load:** `isBootstrapping` state prevents mode being shown before first bootstrap response
- **Hardcoded credentials on login page:** Removed pre-filled email/password and credential hint list
- **Scattered dev/seed language:** Removed "workspace seed", "seeded UI", "demo mode...review build" copy from all pages

### Active
- Frontend not consistently using `config.ts` API_URL (most fetch calls are relative paths, works via Vite proxy)
- TypeScript build has some type errors (runtime unaffected)
- Admin refresh HTTP call is held open for the full scrape duration — long-running sync blocks the tab (no async job polling yet)

---

## Current Production Metrics (March 9, 2026)

```
Vehicles Scraped:        489 / 489 (100%)
Competitor Listings:     2,159 (874 Carzone + 1,285 CarsIreland)
Vehicle Matches:         10,507
Pricing Recommendations: 1,467
Data Coverage:           100%
Scrape Duration (post-optimisation): ~18 min (was ~110 min)
```

---

## TODO / Roadmap

### In progress (`feat/scraper-perf-optimisation`)
- [x] Deduplicated parallel competitor scraping (~6x fewer browser sessions)
- [x] Scraping progress banner with animated bar + elapsed timer
- [x] Dismissible error alert on scrape failure
- [x] Cleaner Admin page (descriptions, time estimates, active-source highlighting)
- [x] Remove all demo/seed language from production UI
- [x] Fix "Demo data" flash on page load

### Next
- [ ] Async scrape jobs (fire-and-forget + polling) so the browser tab isn't blocked
- [ ] Toast notifications for pricing decisions and file generation
- [ ] CSV export for pricing files
- [ ] Consistent use of `config.ts` API_URL across frontend

### Phase 2
- [ ] Scheduled scraping (cron UI)
- [ ] Email alerts for pricing anomalies
- [ ] PDF pricing reports
- [ ] Bulk pricing decisions
- [ ] Price history charts
- [ ] Competitor tracking dashboard

### Technical
- [ ] Redis caching layer
- [ ] Sentry error tracking
- [ ] CI/CD pipeline
- [ ] Integration tests
- [ ] DB backups

### Business
- [ ] Multi-dealer tenancy (schema already supports it via dealershipId)
- [ ] Custom pricing rules engine
- [ ] Automated repricing
- [ ] DMS integration

---

## Key Decisions & Rationale

| Decision | Rationale |
|---|---|
| Playwright over Firecrawl | Free, full control, working with string-eval fix |
| Bootstrap pattern (single API call) | Simpler than multiple endpoints, fast enough at current scale |
| Store all raw scraped data | Full audit trail, can re-parse without re-scraping |
| Two competitor sites only | Carzone + CarsIreland cover majority of Irish used car market |
| Confidence weighting (HIGH/MEDIUM only) | Low confidence matches distort pricing |
| Deduplicate scrapes by make/model | One browser session per unique (make, model) pair instead of per vehicle — ~6x fewer sessions, same match quality |
| Concurrency limit = 4 groups | Balance between speed and memory; each group opens one browser context |
| `RawScrapedListing` type | Clean separation between "what was scraped" and "how it scores against a specific vehicle" |
| `isBootstrapping` state | Prevents "Demo data" flash before first server response; users see "Connecting…" instead |
| DEMO_MODE for client previews | Static DB + read-only mode lets client review UI without live scrapers running |
| dealershipId everywhere | Future SaaS multi-tenancy ready from day one |

---

**Repository:** https://github.com/Umaraslam66/autoexpress
**Last Updated:** March 14, 2026
**Version:** 1.2.0
