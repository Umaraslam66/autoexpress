# AutoXpress Pricing Intelligence Platform

## Product Requirements Document

Version: 1.0  
Audience: Product owner, frontend developer, backend developer, QA, DevOps  
Product type: Internal web platform with future SaaS potential

---

## 1. Executive Summary

AutoXpress manages 400+ used cars and currently checks market pricing manually across `autoxpress.ie`, `carzone.ie`, and `carsireland.ie`. This is operationally expensive, inconsistent, and slows down stock buying decisions.

The goal of this product is to give the pricing manager a single internal platform that:

1. Imports AutoXpress stock into a structured database.
2. Collects comparable market listings from CarsIreland and Carzone.
3. Matches AutoXpress vehicles to relevant competitor listings.
4. Produces pricing recommendations, market summaries, and exportable pricing files.
5. Reduces manual pricing work so the team can focus more on buying stock.

This document defines the recommended MVP scope and the technical/product decisions required for developers to build the system correctly.

---

## 2. Product Vision

Build an internal pricing intelligence platform for used-car retail in Ireland that helps AutoXpress:

1. See every in-stock vehicle in one place.
2. Understand how each vehicle is positioned against the live market.
3. Make faster, better pricing decisions.
4. Maintain a trackable history of price changes and market evidence.
5. Evolve later into a multi-dealer SaaS product without re-architecture.

---

## 3. Problem Statement

Current issues:

1. Pricing checks are manual and time-consuming.
2. Market comparisons are spread across multiple websites.
3. There is no central system of record for pricing decisions.
4. Vehicle-by-vehicle pricing logic is inconsistent and difficult to audit.
5. Pricing work takes time away from stock acquisition and broader dealership operations.

---

## 4. Goals

### Primary goals

1. Centralize AutoXpress inventory and competitor market data.
2. Provide reliable comparable-vehicle matching for pricing analysis.
3. Generate pricing recommendations with clear reasoning.
4. Allow creation of pricing files per stock vehicle/model.
5. Support CSV export and filtering for daily pricing operations.

### Secondary goals

1. Keep refresh frequency at least twice daily.
2. Design the architecture so additional source websites can be added later.
3. Support future multi-dealer tenancy.
4. Maintain a full audit trail of pricing updates and overrides.

### Non-goals for MVP

1. Full dealer management system.
2. Public-facing customer marketplace.
3. Automated price publishing back to external sites.
4. Fully autonomous repricing without human approval.
5. Native mobile apps.

---

## 5. Users and Roles

### MVP roles

#### 1. Pricing Manager

Primary user. Reviews stock, evaluates comparable listings, accepts or overrides recommendations, exports pricing files.

#### 2. Admin

Manages users, source configuration, scraper health, system settings, and export templates.

### Future roles

1. Buyer
2. Dealer group manager
3. Read-only analyst

---

## 6. Core User Jobs

The platform must let the pricing manager:

1. Open the dashboard and immediately see which vehicles need attention.
2. Search or filter by make, model, year, fuel, transmission, mileage, age in stock, and pricing status.
3. Open a single AutoXpress vehicle and view relevant market comparables from CarsIreland and Carzone.
4. Understand market range, median, cheapest comparable, most similar comparable, and listing age.
5. See a suggested retail price with reasoning.
6. Adjust the final target price manually when needed.
7. Save a pricing decision with comments and audit history.
8. Export selected vehicles or pricing files to CSV.

---

## 7. Recommended Product Scope

### 7.1 MVP modules

1. Authentication and user management
2. Inventory ingestion for AutoXpress stock
3. External market data ingestion from Carzone and CarsIreland
4. Vehicle normalization and matching engine
5. Pricing dashboard
6. Vehicle detail page with comps and recommendation
7. Pricing file generation and export
8. Job scheduler, monitoring, and admin tools

### 7.2 Future modules

1. Multi-dealer tenancy
2. More listing sources
3. Notification system
4. Auto repricing rules
5. BI reporting
6. API integrations to dealer management systems

---

## 8. End-to-End User Journey

### Journey 1: First-time setup

1. Admin creates the dealership account.
2. Admin configures the AutoXpress inventory source.
3. Admin configures scraping jobs for CarsIreland and Carzone.
4. System runs initial import:
   - Import own stock first.
   - Import market listings second.
   - Normalize data third.
   - Run matching fourth.
5. Admin reviews source health and confirms successful import counts.
6. Pricing manager logs in and sees the initial dashboard.

### Journey 2: Daily pricing workflow

1. Pricing manager logs in.
2. Dashboard shows:
   - Vehicles with no recent market refresh.
   - Vehicles with weak comparable coverage.
   - Vehicles above market.
   - Vehicles below market.
   - New stock needing first pricing review.
3. User filters to actionable vehicles.
4. User opens a vehicle detail page.
5. System shows:
   - AutoXpress vehicle attributes.
   - Competitor listings grouped by source.
   - Match confidence.
   - Market statistics.
   - Suggested price range and target price.
6. User accepts recommendation or sets a manual override.
7. User adds internal notes.
8. System stores decision in pricing history.
9. User exports selected records if needed.

### Journey 3: Creating a pricing file

1. User selects one stock unit or a group of vehicles.
2. User clicks `Generate Pricing File`.
3. System creates a structured record containing:
   - AutoXpress vehicle details
   - Comparable listings snapshot
   - Market statistics at time of generation
   - Suggested price
   - Final chosen target price
   - Notes and date
4. User exports as CSV initially.
5. Future enhancement: export as branded PDF report.

### Journey 4: Exception handling

1. A scraper fails or a source changes layout.
2. Admin dashboard flags ingestion health warnings.
3. Existing historical data remains viewable.
4. Affected vehicles are marked as `stale market data`.
5. Pricing manager can still review previous comps and manually price.

---

## 9. Key Product Decisions

### 9.1 How AutoXpress inventory should enter the system

Recommended approach for MVP:

1. Primary path: ingest AutoXpress stock from a structured feed if available.
   - Best options in order:
   - Dealer management API
   - Inventory export feed
   - Scheduled CSV import
2. Fallback path: scrape `autoxpress.ie` stock listings if no structured source exists.
3. Manual upload must still exist as a backup:
   - CSV upload via admin UI
   - Used for emergency correction or source failure

Recommended implementation decision:

Do not rely only on scraping the AutoXpress public website if a backend feed/export exists. Public-site scraping is acceptable for MVP bootstrapping but should not be the long-term primary source because it is fragile, incomplete, and harder to trust operationally.

### 9.2 How external data should enter the system

1. Build a source-adapter architecture.
2. Create one adapter per site:
   - `carzone`
   - `carsireland`
3. Each adapter is responsible for:
   - Search/listing discovery
   - Detail page extraction
   - Rate limiting
   - Retry behavior
   - Source-specific selectors or parsers

### 9.3 How vehicles should be matched

Use a hybrid scoring approach rather than direct exact matches only.

Rationale:

1. External sites may not expose VIN.
2. Registration number may be hidden or absent.
3. Dealer-entered titles are inconsistent.
4. Trim/spec text is noisy.

Recommended matching hierarchy:

1. Exact or near-exact identifiers if available:
   - Registration
   - VIN fragment
   - Stock reference
2. Strong structured attributes:
   - Make
   - Model
   - Year
   - Body type
   - Fuel
   - Transmission
   - Engine size
3. Soft attributes:
   - Trim/spec keywords
   - Mileage band
   - Dealer location
   - Price band

The system should calculate a match confidence score and categorize matches as:

1. High confidence
2. Medium confidence
3. Low confidence

Only high and medium confidence matches should affect pricing recommendations by default. Low confidence matches may be shown separately.

### 9.4 How pricing recommendations should work

MVP recommendation logic should be rules-based and explainable, not ML-based.

Use:

1. Weighted comparable set
2. Outlier removal
3. Market median and percentile analysis
4. Mileage/year adjustments
5. Listing-age awareness

This is preferable to machine learning in MVP because it is faster to build, easier to validate, and easier for business users to trust.

---

## 10. Functional Requirements

## 10.1 Authentication and Access Control

1. Secure login with email and password.
2. Password reset flow.
3. Role-based access:
   - Admin
   - Pricing Manager
4. Session timeout and secure cookies.
5. Audit log for key actions.

## 10.2 Inventory Management

1. Import AutoXpress vehicles into a normalized inventory table.
2. Required vehicle fields:
   - Internal stock ID
   - Registration number if available
   - VIN if available
   - Make
   - Model
   - Variant/trim
   - Year
   - Mileage
   - Fuel type
   - Transmission
   - Body type
   - Engine size
   - Colour
   - Price
   - Status
   - Date added to stock
   - Location
   - Vehicle URL on AutoXpress site
3. Support incremental updates:
   - New stock
   - Sold stock
   - Price changes
   - Attribute updates
4. Mark delisted/sold vehicles as inactive rather than hard-deleting.

## 10.3 Market Data Collection

1. Collect listings from Carzone and CarsIreland.
2. Required competitor fields:
   - Source site
   - Source listing ID
   - Listing URL
   - Title
   - Make
   - Model
   - Variant/trim
   - Year
   - Mileage
   - Fuel type
   - Transmission
   - Body type
   - Engine size if available
   - Price
   - Dealer name
   - Dealer location
   - Listing date if available
   - Days listed if derivable
   - Image URL if allowed
   - Last seen timestamp
3. Refresh frequency:
   - Minimum twice daily
   - Prefer every 6 to 12 hours per source
4. Preserve historical snapshots of pricing and listing presence.

## 10.4 Normalization

The system must standardize:

1. Make names
2. Model names
3. Fuel labels
4. Transmission labels
5. Mileage units
6. Currency
7. Location naming
8. Trim/spec keywords

Use canonical enums/tables for structured fields and keep raw source text for traceability.

## 10.5 Matching Engine

1. Match each AutoXpress stock unit against relevant competitor listings.
2. Allow one AutoXpress unit to have many competitor matches.
3. Store:
   - Match score
   - Match explanation
   - Match status
   - Last evaluated time
4. Support manual include/exclude actions by pricing manager.
5. Manual overrides must influence future recommendation calculations for that stock unit until reset.

## 10.6 Pricing Recommendation Engine

For each AutoXpress stock unit, calculate:

1. Comparable count
2. Market minimum
3. Market maximum
4. Market median
5. Market average
6. Similar-mileage median
7. Similar-year median
8. Suggested price range
9. Suggested target retail price
10. Price position:
   - Below market
   - In market
   - Above market

The recommendation should display reasoning such as:

1. Based on 12 comparable listings.
2. Median market price is EUR X.
3. Your car has lower mileage than median comps by Y km.
4. Current price is Z% above market median.

## 10.7 Dashboard

Dashboard must include:

1. Total in-stock vehicles
2. Vehicles with sufficient comps
3. Vehicles needing review
4. Vehicles above market threshold
5. Vehicles below market threshold
6. Average days in stock
7. Recent price changes
8. Scraper/source health summary

Required filters:

1. Make
2. Model
3. Year
4. Fuel
5. Transmission
6. Body type
7. Mileage range
8. Current price range
9. Days in stock
10. Pricing status
11. Source freshness
12. Match confidence

## 10.8 Vehicle Detail View

For a selected AutoXpress vehicle, show:

1. Vehicle header card
2. Current AutoXpress price
3. Historical AutoXpress price changes
4. Recommended price range
5. Final chosen target price
6. Competitor listings table
7. Competitor listings map or location summary
8. Market trend summary
9. Matching confidence and excluded comps
10. Notes/activity timeline

Comp table columns:

1. Source
2. Dealer
3. Location
4. Year
5. Mileage
6. Fuel
7. Transmission
8. Trim/spec
9. Listed price
10. Days listed
11. Match score
12. Listing URL

## 10.9 Pricing Files and Exports

The system must support:

1. CSV export for filtered stock lists
2. CSV export for one vehicle pricing file
3. CSV export for batch pricing review
4. Persisted pricing file records with version history

Pricing file contents:

1. Vehicle identity
2. Snapshot timestamp
3. Current price
4. Comparable set
5. Market stats
6. Recommended price
7. Final chosen price
8. User notes
9. User who approved the decision

## 10.10 Admin Module

Admin screens must support:

1. User management
2. Source management
3. Import status
4. Job run history
5. Scraper failure logs
6. Manual re-run of jobs
7. CSV upload
8. Mapping dictionary management

---

## 11. Non-Functional Requirements

### Performance

1. Dashboard initial load under 3 seconds for normal filtered usage.
2. Vehicle detail page under 2 seconds after cached data is available.
3. Background ingestion jobs must not block UI.

### Reliability

1. Background jobs must be retryable.
2. Source failures must not corrupt inventory data.
3. Matching and recommendation jobs must be idempotent.

### Scalability

1. Support 400 to 1,000 stock vehicles comfortably in MVP.
2. Support tens of thousands of competitor listings.
3. Architecture must allow multi-dealer tenancy later.

### Security

1. Encrypted passwords.
2. Role-based authorization.
3. HTTPS in all environments except local development.
4. Audit logs for pricing decisions and admin actions.

### Compliance

1. Respect data privacy for stored user data.
2. Review source-site terms and legal considerations for scraping before production launch.
3. Implement polite crawling, rate limiting, and request backoff.

### Observability

1. Structured logs
2. Error tracking
3. Job metrics
4. Health checks
5. Alerts for failed imports and stale data

---

## 12. UI/UX Requirements

## 12.1 UX Principles

1. The UI must optimize for speed of decision-making, not visual clutter.
2. The pricing manager should understand whether a car is overpriced, underpriced, or correctly positioned within seconds.
3. The user should not need to open external websites for normal workflows.
4. System confidence and data freshness must be visible at all times.
5. Manual override must be easy, but the system should always show the recommended baseline.

## 12.2 Information Architecture

Primary navigation:

1. Dashboard
2. Inventory
3. Pricing Queue
4. Pricing Files
5. Admin

## 12.3 Key Screens

### 1. Login

Simple login page with brand identity and secure reset flow.

### 2. Dashboard

High-level KPI cards, pricing queue, recent alerts, and source health indicators.

### 3. Inventory List

Dense data table optimized for dealership operations. Fast filtering, column customization, sort, bulk actions.

### 4. Vehicle Detail

Split layout:

1. Left: AutoXpress vehicle profile and pricing controls
2. Right: comparable listings and market intelligence

### 5. Pricing File View

Structured, printable/exportable evidence view showing the basis for a pricing decision.

### 6. Admin

Operational control center for imports, mappings, users, and job status.

## 12.4 UX Details

1. Use color coding for pricing position:
   - Green: below market opportunity
   - Amber: near market
   - Red: above market risk
2. Show freshness badges:
   - Refreshed today
   - Refreshed yesterday
   - Stale
3. Show confidence badges:
   - High
   - Medium
   - Low
4. Allow one-click actions:
   - Accept recommendation
   - Set manual price
   - Exclude comp
   - Export pricing file

## 12.5 Accessibility

1. Keyboard accessible tables and dialogs
2. Sufficient color contrast
3. Clear focus states
4. Responsive layout for laptop and tablet use

---

## 13. Frontend Design Direction

The product is an internal business tool. The design should feel premium, operational, and data-heavy without looking like generic admin boilerplate.

### Design goals

1. Clean and dense desktop-first interface
2. Fast scanning of market data
3. Strong visual hierarchy for pricing recommendations
4. Confidence/freshness/status made visually obvious
5. Tablet-friendly but optimized for desktop operations

### Visual style

1. Brand tone: modern automotive operations, trustworthy, efficient
2. Typography:
   - Use a strong sans-serif for UI clarity
   - Use tabular numerals for prices and mileage
3. Layout:
   - Left navigation rail on desktop
   - Sticky filter bar on list pages
   - Sticky pricing summary card on vehicle detail page
4. Components:
   - Data grid
   - Filter chips
   - KPI cards
   - Comparison cards
   - Timeline/activity feed
   - Drawer or modal for quick pricing changes

### Recommended page behavior

1. Dashboard widgets should link directly into filtered lists.
2. Vehicle detail should support quick prev/next navigation through the pricing queue.
3. Filters should persist in URL so users can bookmark workflow views.
4. Large tables should support virtualization or pagination.

---

## 14. Backend Architecture

## 14.1 Recommended Architecture Style

Use a modular monolith for MVP, not microservices.

Reason:

1. Faster to build and maintain.
2. Easier handover.
3. Lower operational complexity.
4. Sufficient for current scale.
5. Can still be structured cleanly into modules for later extraction.

Recommended backend modules:

1. Auth
2. Users
3. Inventory
4. Source adapters
5. Normalization
6. Matching
7. Pricing
8. Exports
9. Admin
10. Job scheduler

## 14.2 System Flow

1. Scheduled job ingests AutoXpress inventory.
2. Scheduled jobs crawl CarsIreland and Carzone.
3. Raw records are stored first.
4. Normalization pipeline converts raw records into canonical listing models.
5. Matching engine links AutoXpress vehicles to external comparables.
6. Pricing engine calculates recommendations.
7. UI reads from precomputed tables/views for speed.

## 14.3 Recommended Tech Stack

### Frontend

1. React
2. TypeScript
3. Vite
4. Tailwind CSS or a well-structured design token system
5. TanStack Table for dense data grids
6. TanStack Query for data fetching and cache control
7. React Router

### Backend

1. Node.js with TypeScript
2. NestJS or Express with strong module boundaries
3. Prisma ORM
4. PostgreSQL
5. Redis for queues/cache
6. BullMQ or equivalent for background jobs

### Scraping / ingestion

1. Playwright for JavaScript-rendered pages and resilient extraction
2. Cheerio/HTML parsing where possible for simple pages
3. Rotating user agents and rate-limited request strategy

### Infrastructure

1. Docker for local/dev consistency
2. Managed PostgreSQL
3. Managed Redis
4. Object storage for export artifacts if needed
5. Hosted on a standard cloud platform such as AWS, DigitalOcean, or Railway depending on deployment preference

### Monitoring

1. Sentry for application errors
2. Structured logging
3. Uptime/health checks

## 14.4 Why this stack is recommended

1. TypeScript across frontend and backend reduces handover friction.
2. PostgreSQL is ideal for structured relational data, filtering, and history.
3. Redis plus job queues cleanly separates scraping and computation from request/response flows.
4. Playwright is practical for anti-bot-sensitive, JS-heavy sites.
5. Modular monolith keeps MVP operationally simple while preserving future SaaS scalability.

---

## 15. Data Architecture

## 15.1 Core Entities

1. `dealership`
2. `user`
3. `vehicle`
4. `vehicle_snapshot`
5. `source_listing_raw`
6. `source_listing_normalized`
7. `vehicle_match`
8. `pricing_recommendation`
9. `pricing_decision`
10. `pricing_file`
11. `job_run`
12. `source_config`
13. `normalization_dictionary`
14. `audit_log`

## 15.2 Storage Strategy

Use a layered data model:

1. Raw layer
   - stores source response output for debugging and parser recovery
2. Normalized layer
   - stores canonical structured listing data
3. Analytical layer
   - stores matches, aggregates, recommendations, and historical snapshots

This is important because source websites will change and parser failures are unavoidable. Raw capture makes the system recoverable without data loss.

## 15.3 Historical Data

Do not overwrite pricing-related records destructively.

Store:

1. Inventory price history
2. Competitor listing history
3. Match history
4. Recommendation history
5. Final decision history

This is required for trend analysis and auditability.

---

## 16. Scraping and Ingestion Strategy

## 16.1 Source Strategy

Each source must have:

1. Listing discovery strategy
2. Pagination handling
3. Detail extraction strategy
4. Anti-bot backoff strategy
5. Failure logging
6. Selector versioning

## 16.2 Refresh Strategy

Recommended cadence:

1. AutoXpress inventory: every 4 hours
2. Carzone market listings: every 12 hours
3. CarsIreland market listings: every 12 hours
4. Matching + recommendation recalculation: after each successful ingestion batch

If runtime or bot pressure becomes an issue, refresh priority should be:

1. AutoXpress stock first
2. Vehicles needing review second
3. Newest stock third
4. Full market recrawl last

## 16.3 Anti-fragility Requirements

1. Use retry with exponential backoff.
2. Store HTML snapshots or parsed payload references for failed records where practical.
3. Detect abnormal drops in listing counts and trigger alerts.
4. Mark data freshness per source so stale data is visible in UI.
5. Build per-source parser tests using saved HTML fixtures.

---

## 17. Matching Logic Specification

Each candidate comparable should receive a score based on:

1. Make exact match
2. Model exact match
3. Variant keyword overlap
4. Year difference
5. Mileage difference
6. Fuel exact match
7. Transmission exact match
8. Body type exact match
9. Engine size similarity
10. Price band reasonableness

Recommended output:

1. `score` numeric value
2. `confidence_level`
3. `explanation_json`

Example explanation:

1. Make/model exact match
2. Year within 1 year
3. Mileage within 15,000 km
4. Fuel and transmission exact match
5. Trim partially matched

The UI should expose why a comparable was included or excluded.

---

## 18. Pricing Engine Specification

## 18.1 Suggested MVP logic

1. Take all active high-confidence matches.
2. Optionally include medium-confidence matches with lower weighting.
3. Remove obvious outliers using rules:
   - Too cheap versus rest of set
   - Too expensive versus rest of set
   - Mileage/year mismatch beyond thresholds
4. Calculate market stats.
5. Apply mileage and year adjustment factors.
6. Produce:
   - suggested floor
   - suggested target
   - suggested ceiling

## 18.2 Recommended pricing position thresholds

1. `Below market`: current price is more than 3% below adjusted market target
2. `In market`: within +/- 3%
3. `Above market`: more than 3% above adjusted market target

These values should be configurable in admin settings.

## 18.3 Human override behavior

1. User can set a manual target price.
2. User must optionally provide a note for major overrides.
3. Manual decisions are stored separately from the system recommendation.
4. System recommendation must remain visible for auditability.

---

## 19. API Requirements

Recommended API domains:

1. `/auth`
2. `/users`
3. `/vehicles`
4. `/vehicles/:id/matches`
5. `/vehicles/:id/pricing`
6. `/pricing-files`
7. `/exports`
8. `/admin/jobs`
9. `/admin/sources`
10. `/admin/dictionaries`

API requirements:

1. Pagination for all large datasets
2. Server-side filtering and sorting
3. Role-based authorization
4. Audit logging on mutations
5. Idempotent admin rerun endpoints where applicable

---

## 20. Reporting and Export Requirements

MVP exports:

1. Inventory pricing queue CSV
2. Vehicle pricing file CSV
3. Market comparable export CSV

Future exports:

1. PDF pricing report
2. Weekly market digest
3. Price-change recommendation report

---

## 21. Testing Requirements

## 21.1 Frontend

1. Component tests for core pricing interactions
2. Integration tests for filters, tables, and vehicle detail flow
3. End-to-end smoke tests for login, dashboard, pricing review, and export

## 21.2 Backend

1. Unit tests for normalization logic
2. Unit tests for matching logic
3. Unit tests for pricing calculations
4. API integration tests
5. Job processing tests

## 21.3 Scrapers

1. Parser fixture tests using stored HTML samples
2. Alerting when extraction success rate falls below threshold
3. Manual QA checklist for source layout changes

---

## 22. Delivery Quality Requirements

Developers should deliver:

1. Full source code in client-owned repository
2. Environment setup documentation
3. Deployment documentation
4. Admin operations guide
5. Data model documentation
6. API documentation
7. Source adapter extension guide for adding future websites

---

## 23. Acceptance Criteria for MVP

The MVP is complete when:

1. AutoXpress stock can be imported reliably into the platform.
2. Carzone and CarsIreland listings can be collected on a schedule.
3. Each AutoXpress vehicle can display a relevant comparable set.
4. The system shows a suggested price range and target price per stock unit.
5. Pricing manager can manually override and save final decisions.
6. Pricing files can be generated and exported as CSV.
7. Admin can monitor job runs and source failures.
8. Historical pricing decisions and market snapshots are retained.

---

## 24. Recommended Build Order

1. Authentication and base admin
2. AutoXpress inventory ingestion
3. Raw and normalized data model
4. Source adapters for CarsIreland and Carzone
5. Matching engine
6. Pricing engine
7. Inventory list and vehicle detail UI
8. Dashboard and pricing queue
9. Exports and pricing files
10. Monitoring, retries, fixture tests, and hardening

---

## 25. Risks and Mitigations

### Risk 1: Source sites change layout or block scraping

Mitigation:

1. Source-adapter isolation
2. Parser fixture tests
3. Retry/backoff
4. Health monitoring
5. Raw snapshot storage

### Risk 2: Weak vehicle matching due to inconsistent listing data

Mitigation:

1. Normalization dictionaries
2. Match scoring rather than exact-only matching
3. Manual include/exclude support
4. Confidence visibility

### Risk 3: Poor trust in pricing recommendations

Mitigation:

1. Explainable rules-based pricing
2. Transparent comparable set
3. Separate manual override path
4. Historical audit log

### Risk 4: Own inventory source is unreliable

Mitigation:

1. Prefer structured source over public scraping
2. Provide CSV fallback import
3. Make ingestion source configurable

---

## 26. Future SaaS Readiness Requirements

Even if MVP is single-dealer, developers should prepare for:

1. Tenant-aware data model
2. Source config per dealership
3. Permission segregation by tenant
4. Dealer-branded exports later
5. Subscription and billing modules later without major rewrite

This means every business entity should be associated with a dealership/tenant ID from day one.

---

## 27. Final Recommendation

The best MVP approach is:

1. Build a secure internal web app.
2. Ingest AutoXpress inventory from a structured feed if possible, with website scrape and CSV fallback.
3. Scrape CarsIreland and Carzone on scheduled background jobs.
4. Normalize all listings into a canonical model.
5. Use rules-based matching and explainable pricing recommendations.
6. Optimize the frontend around fast pricing review, not generic CRM features.
7. Keep the backend as a modular TypeScript monolith with PostgreSQL, Redis, and job queues.
8. Preserve raw data and historical snapshots for resilience, auditability, and future reporting.

This approach is the most practical balance of delivery speed, reliability, maintainability, and future SaaS expansion.
