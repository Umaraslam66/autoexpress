# AutoXpress Deployment Guide

## Modes

This project supports two deployment modes:

### 1. Demo preview
- Purpose: client review, read-only walkthrough, no live scraping
- Required services: web only
- Required env: `DEMO_MODE=true`, `SESSION_SECRET`
- Optional env: `DATABASE_URL`, `REDIS_URL`
- Behavior:
  - login works against bundled demo users
  - dashboard data comes from `src/data/mockData.ts`
  - pricing writes and source refresh actions are disabled

### 2. Live production
- Purpose: real dealership usage with scraping and saved pricing actions
- Required services: web + worker + PostgreSQL + Redis
- Required env: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`
- Optional env: `AUTOXPRESS_FEED_URL`, scrape limits
- Behavior:
  - login uses database-backed users
  - bootstrap reads from PostgreSQL
  - refresh jobs run through BullMQ/Redis
  - worker runs Playwright scrapers

## Important Runtime Notes

- `npm run start:web` now starts safely in both modes.
- In demo mode it does not try to touch Prisma or the database.
- In live mode it applies schema on boot with:
  - `prisma migrate deploy` if `prisma/migrations/` exists
  - otherwise `prisma db push --skip-generate`
- This repo does not currently contain Prisma migrations, so live deploys still use `db push`.
- If you want stricter production change control, add Prisma migrations before handing this to the client.

## Railway

## Demo preview on Railway

Use this when you want to show the product quickly without scraper infrastructure.

1. Deploy the repo as a single web service.
2. Set:

```env
DEMO_MODE=true
SESSION_SECRET=<strong-random-secret>
NODE_ENV=production
```

3. Do not deploy a worker.
4. Open the Railway generated domain and log in with:
   - `admin@autoxpress.ie` / `autoxpress`
   - `pricing@autoxpress.ie` / `autoxpress`

This is the safest way to share a working preview without exposing scraper reliability issues.

## Live production on Railway

Use this when the client is ready to operate the platform for real.

1. Deploy the repo as a web service.
2. Add PostgreSQL.
3. Add Redis.
4. Create a second service from the same repo for the worker.
5. Set the worker start command to:

```bash
npm run start:worker
```

6. Set the web and worker env vars:

```env
NODE_ENV=production
SESSION_SECRET=<strong-random-secret>
DATABASE_URL=<railway-postgres-url>
REDIS_URL=<railway-redis-url>
AUTOXPRESS_FEED_URL=
SCRAPE_MAX_VEHICLES=50
SCRAPE_MAX_AUTOXPRESS_PAGES=5
SCRAPE_MAX_COMPARABLES_PER_SOURCE=10
```

## Client handoff on Railway

Recommended sequence:

1. First share a demo deploy from your Railway project.
2. Once approved, create a new Railway project owned by the client.
3. Connect the same GitHub repo, or transfer the repo to the client first.
4. Recreate the production stack in the client-owned project:
   - web
   - worker
   - postgres
   - redis
5. Point the client domain to the new project.

This is cleaner than trying to keep billing and ownership mixed in your own project long-term.

## Custom domain

For either mode:

1. Add the domain in the hosting platform dashboard.
2. Update DNS at the registrar with the required CNAME or A/ALIAS record.
3. Wait for SSL provisioning.
4. If frontend and API stay on the same service, no `VITE_API_URL` is needed.

## Recommended Option Matrix

### Option A: Railway demo now, Railway production later
- Best for: fastest client review and lowest migration effort
- Pros:
  - already closest to your current setup
  - same repo and same deployment model
  - easiest domain setup later
- Cons:
  - scraper success can still depend on remote target blocking and runtime limits

### Option B: Railway demo now, Render production later
- Best for: managed platform with separate web/worker primitives and less coupling to your current account
- Pros:
  - good separation between web service and worker service
  - easy custom domain flow
- Cons:
  - you still need PostgreSQL, Redis, and Playwright-compatible worker runtime
  - slightly more migration work than staying on Railway

### Option C: Demo on Railway, production on a VPS
- Best for: highest scraper control and long-term client ownership
- Pros:
  - full control over Chromium, memory, and background jobs
  - easiest to debug scraper breakage
  - simplest billing story for the client
- Cons:
  - you own more ops work
  - backups, monitoring, TLS, and deploy automation become your responsibility

## What I Recommend

For this project, the best path is:

1. Keep Railway for the client demo with `DEMO_MODE=true`.
2. After approval, deploy a fresh client-owned live environment.
3. Choose:
   - Railway if the client wants the simplest managed setup
   - a VPS if scraper reliability matters more than platform convenience

If you want the least risky handoff, do not migrate the existing demo project into production. Treat the demo and live client system as separate deployments.
