# X-Crude - Development Approach

---

## 1. Overview

This document describes the development approach for building X-Crude (Crude Oil Logistics Platform). It is designed to be used alongside `x_crude_user_stories.md` and `x_crude_database_schema.sql` as context for LLM-assisted development.

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Schema-First** | Database schema is defined completely before any feature work |
| **Isolated Features** | Each feature is self-contained. Changes to one feature don't affect others |
| **Desktop-First** | UI optimized for desktop, but must work on mobile/tablet |
| **Real Auth First** | Email/Password auth configured in Phase 1. Invite-only (no registration) |
| **Incremental Validation** | Each step is tested and validated before moving to the next |
| **CRUD via Supabase** | All basic CRUD operations go directly from Angular to Supabase |
| **Complex Logic via FastAPI** | Sync, versioning, AI chat, and business logic go through FastAPI |
| **AI Chat Early** | Embedded chat testable as early as possible |

### 1.2 Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| **Database** | Supabase PostgreSQL + RLS | Supabase Cloud |
| **Auth** | Supabase Auth (Email/Password, Invite-only) | Supabase Cloud |
| **Frontend** | Angular 19 + Tailwind CSS 3 + Lucide Icons | Vercel |
| **Backend API** | FastAPI (Python 3.11+) | Railway |
| **Optimization Worker** | Python (separate service) | Hetzner |
| **AI Chat** | Anthropic SDK (Claude) | via FastAPI |
| **Email** | Resend | via FastAPI |

### 1.3 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Browser)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Angular Frontend (Vercel)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Auth UI   │  │  Base Data  │  │  Portfolio  │  │  Results + Chat     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                                    │
          │ CRUD, Auth                                         │ Complex Operations
          ▼                                                    ▼
┌─────────────────────────────────────┐    ┌───────────────────────────────────┐
│      Supabase Cloud                 │    │        FastAPI (Railway)          │
│  ┌───────────┐                      │    │                                   │
│  │ PostgreSQL│◄──────────────────────────┤  POST /api/version/create         │
│  │ + RLS     │                      │    │  POST /api/sync/into              │
│  └───────────┘                      │    │  POST /api/sync/from              │
│  ┌───────────┐                      │    │  POST /api/portfolio/validate     │
│  │   Auth    │                      │    │  POST /api/chat                   │
│  └───────────┘                      │    │  POST /api/invite                 │
└─────────────────────────────────────┘    └───────────────────────────────────┘
          ▲                                           │
          │                                           │
          │ Polls for CalculationReady                └───────────────────┐
          │ Writes results                                                │
          │                                 ┌─────────────────────────────┼────┐
          │                                 ▼                             ▼    │
    ┌──────────┐                      ┌──────────┐                  ┌──────────┐
    │ Hetzner  │                      │ Anthropic│                  │  Resend  │
    │ Worker   │                      │  Claude  │                  │  Email   │
    └──────────┘                      └──────────┘                  └──────────┘
```

**Key Principles:**
- **Angular → Supabase directly** for CRUD operations and auth
- **Angular → FastAPI** for:
  - Version management (create new version)
  - Sync functions (sync into/from)
  - Portfolio validation
  - Optimization trigger & status
  - AI Chat
  - User invitations
- **Optimization Worker → Supabase directly** for reading input and writing results

---

## 2. Project Structure

```
x-crude/
├── docs/
│   ├── x_crude_user_stories.md
│   ├── x_crude_specification_v2.md
│   ├── x_crude_database_schema.sql
│   ├── x_crude_development_approach.md    # This document
│   └── x_crude_worker_architecture.md     # Worker & Realtime docs
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── backend/                                # FastAPI app (Railway)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   │
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── version.py              # /api/version/create
│   │   │   ├── sync.py                 # /api/sync/into, /api/sync/from
│   │   │   ├── portfolio.py            # /api/portfolio/validate
│   │   │   ├── chat.py                 # /api/chat
│   │   │   └── invite.py               # /api/invite
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── supabase.py             # Supabase Python client
│   │   │   ├── versioning.py           # Version logic
│   │   │   ├── sync.py                 # Sync logic
│   │   │   ├── validation.py           # Portfolio validation
│   │   │   ├── chat.py                 # Anthropic SDK integration
│   │   │   └── email.py                # Resend client
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py              # Pydantic models
│   │   │
│   │   └── tools/                      # AI Chat tools
│   │       ├── __init__.py
│   │       ├── portfolio_tools.py
│   │       └── base_data_tools.py
│   │
│   ├── tests/
│   │   └── ...
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                               # Angular app (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── __mocks__/              # Test mocks
│   │   │   │   ├── supabase.mock.ts
│   │   │   │   ├── auth.mock.ts
│   │   │   │   ├── api.mock.ts
│   │   │   │   ├── toast.mock.ts
│   │   │   │   ├── router.mock.ts
│   │   │   │   └── lucide.mock.ts
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── services/
│   │   │   │   │   ├── supabase.service.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   └── api.service.ts      # FastAPI client
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── role.guard.ts
│   │   │   │   └── models/
│   │   │   │       ├── contract.model.ts
│   │   │   │       ├── cargo.model.ts
│   │   │   │       ├── vessel.model.ts
│   │   │   │       ├── location.model.ts
│   │   │   │       ├── portfolio.model.ts
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar/
│   │   │   │   ├── header/
│   │   │   │   └── main-layout/
│   │   │   │
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── forgot-password/
│   │   │   │   │   └── accept-invite/
│   │   │   │   │
│   │   │   │   ├── base-data/
│   │   │   │   │   ├── contracts/
│   │   │   │   │   │   ├── contract-list/
│   │   │   │   │   │   ├── contract-detail/
│   │   │   │   │   │   └── contract-edit/
│   │   │   │   │   ├── vessels/
│   │   │   │   │   ├── locations/
│   │   │   │   │   └── export-vessel-configs/
│   │   │   │   │
│   │   │   │   ├── portfolio/
│   │   │   │   │   ├── portfolio-list/
│   │   │   │   │   ├── portfolio-edit/
│   │   │   │   │   │   ├── basic-data/
│   │   │   │   │   │   ├── fleet-section/
│   │   │   │   │   │   ├── contracts-section/
│   │   │   │   │   │   └── discharge-section/
│   │   │   │   │   └── portfolio-results/
│   │   │   │   │
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat-button/
│   │   │   │   │   ├── chat-panel/
│   │   │   │   │   └── chat.service.ts
│   │   │   │   │
│   │   │   │   └── admin/
│   │   │   │       └── user-management/
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── components/
│   │   │       │   ├── data-table/
│   │   │       │   ├── expandable-row/
│   │   │       │   ├── tag-input/
│   │   │       │   ├── sync-status-badge/
│   │   │       │   ├── version-badge/
│   │   │       │   └── confirmation-dialog/
│   │   │       └── pipes/
│   │   │           ├── barrel-format.pipe.ts
│   │   │           └── date-format.pipe.ts
│   │   │
│   │   └── test-setup.ts               # Angular TestBed initialization
│   │
│   ├── vitest.config.mts               # Frontend test config
│   ├── tailwind.config.js
│   ├── angular.json
│   └── package.json
│
├── tests/                                  # RLS & Integration Tests
│   ├── setup.ts                        # Test factories, adminClient, toDenyAccess
│   ├── access-matrix.test.ts           # Permission matrix tests
│   └── rls/
│       ├── contracts.test.ts
│       ├── vessels.test.ts
│       ├── portfolios.test.ts
│       └── shares.test.ts
│
├── scripts/
│   └── test-runner.ts                  # Supabase branch management for RLS tests
│
├── vitest.config.ts                        # RLS test config
│
└── worker/                                 # Optimization Worker (Hetzner)
    └── (separate repository, not in scope)
```

---

## 3. Development Phases

### Phase 1: Foundation

#### 1A - Supabase Setup ✅
- [x] Create Supabase project (ngjtbwxyeclfwewrczut)
- [x] Run database schema SQL (initial_schema.sql + fix_profiles_insert_policy.sql)
- [x] Verify RLS policies
- [x] Configure auth (email/password)
- [x] Disable public registration (invite-only)
- [x] Create first admin user manually
- [x] Note credentials (URL, anon key, service role key)
- [x] Enable Realtime for portfolios + optimization_logs tables

#### 1B - RLS Test Infrastructure ✅
- [x] Install dependencies: `vitest @supabase/supabase-js dotenv @faker-js/faker`
- [x] Create `tests/` directory structure
- [x] Create `tests/setup.ts`:
  - [x] adminClient (service role, bypasses RLS)
  - [x] createClientAs(user) (authenticated client with RLS enforced)
  - [x] toDenyAccess() custom matcher (SELECT=empty, INSERT=error, UPDATE/DELETE=empty+.select())
  - [x] Test factories: createUser, createShare, createContract, createVessel, createLocation, createCargo
  - [x] cleanupTestData() (FK dependency order: portfolio tables → cargos → shares → entities → auth users)
- [x] Create `vitest.config.ts` for RLS tests (fork pooling for isolation)
- [x] Add npm scripts: `test:rls:local`, `test:rls:watch`
- [x] Write initial RLS tests for core tables (profiles, shares)
- [x] 25 tests passing, 3 skipped (documenting RLS security gaps in schema)
- Note: Branch management deferred - testing against local/dev database with cleanup

#### 1C - FastAPI Setup ✅
- [x] Create FastAPI project structure (`backend/app/main.py`, `config.py`)
- [x] Configure environment variables (Pydantic BaseSettings, `.env.example`)
- [x] Setup Supabase Python client (dependency injection via `get_supabase()`)
- [x] Create health check endpoint (`GET /api/health`, `GET /api/ping-db`)
- [x] Deploy to Railway (https://imaginative-commitment-production.up.railway.app)
- [x] Verify connectivity to Supabase (ping-db successfully queries database)

#### 1D - Angular Setup ✅
- [x] Create Angular 19 project
- [x] Install and configure Tailwind CSS v4
- [x] Install Lucide icons
- [x] Setup Supabase JS client
- [x] Setup API service for FastAPI
- [x] Configure environment files
- [x] Deploy to Vercel (https://x-crude-frontend.vercel.app)

#### 1E - Frontend Test Infrastructure ✅
- [x] Install: vitest, @analogjs/vitest-angular, @analogjs/vite-plugin-angular, jsdom
- [x] Create `vitest.config.mts` with AnalogJS plugin, pool: 'forks'
- [x] Create `src/test-setup.ts` (Zone.js via @analogjs/vitest-angular/setup-zone)
- [x] Create mock infrastructure for Supabase, auth, router (using vi.fn())
- [x] Add npm scripts: `test`, `test:watch`, `test:coverage`, `test:ui`
- [x] Migrated from Karma/Jasmine to Vitest - 419 unit tests passing

#### 1F - Auth Flow ✅
- [x] Login page (email/password)
- [x] Forgot password page
- [x] Accept invite page (set password)
- [x] Auth guard
- [x] Role guard (admin vs planner)
- [x] Auth service with session management (BehaviorSubject, deadlock prevention)
- [x] Logout functionality
- [x] **Tests:** Auth service tests, guard tests (13 tests)

#### 1G - Layout Shell ✅
- [x] Main layout component (LayoutShell)
- [x] Sidebar navigation (Base Data, Portfolio, Admin sections)
- [x] Header with hamburger menu and X-Crude brand
- [x] User menu dropdown with logout
- [x] Mobile responsive sidebar (overlay on mobile, static on desktop)
- [x] **Tests:** Layout component tests

---

### Phase 2: Base Data (Read)

Goal: Display all Base Data entities with proper access control.

#### 2A - Contracts List & Detail ✅
- [x] Contract list page with table
- [x] Search by name
- [x] Filter by ownership type
- [x] Contract detail page (read-only)
- [x] Cargos table within contract
- [x] Tags display
- [x] "My Items" vs "Shared with Me" tabs
- [x] **Tests:** ContractListComponent, ContractDetailComponent

#### 2B - Vessels List & Detail ✅
- [x] Vessel list page with table
- [x] Search by name/IMO
- [x] Vessel detail page (read-only)
- [x] Fuel consumption display
- [x] Outchartering config display (if exists)
- [x] Tags display
- [x] **Tests:** VesselListComponent, VesselDetailComponent

#### 2C - Locations List & Detail ✅
- [x] Locations list page
- [x] Filter by type (FPSO, STS, etc.)
- [x] Location detail page
- [x] Type-specific fields (FPSO vs STS)
- [x] **Tests:** LocationListComponent, LocationDetailComponent

#### 2D - Export Vessel Configs ✅
- [x] Config list page
- [x] Config detail with allowed locations
- [x] **Tests:** ExportVesselConfigListComponent, ConfigDetailComponent

#### 2E - Base Data RLS Tests ✅
- [x] Write RLS tests for contracts (owner, shared read, shared write, denied)
- [x] Write RLS tests for vessels
- [x] Write RLS tests for locations
- [x] Write RLS tests for cargos (via contract access)
- [x] Permission matrix tests: ISO (tenant isolation), SHA (sharing), CTW (cross-tenant write), ADM (admin override), INH (inheritance)
- [x] Created branch-based test runner (scripts/test-runner.ts) using Supabase CLI
- [x] Created migration 20260121000000_fix_select_policies_for_insert_returning.sql
- [x] 83 RLS tests passing (6 test files)

---

### Phase 3: Base Data (Write)

#### 3A - FastAPI Version Endpoint ✅
- [x] POST /api/version/create endpoint
- [x] Version bump logic (patch/minor/major)
- [x] is_latest flag management
- [x] Child entity copying (cargos for contracts, locations for configs)
- [x] **Tests:** FastAPI endpoint tests (pytest) - 13 tests

#### 3B - Contract CRUD ✅
- [x] Create contract form
- [x] Edit contract form (creates new version via FastAPI)
- [x] Add/edit/delete cargos within contract (CargoManagerComponent)
- [x] Copy contract (pre-fills form with source data)
- [x] Delete contract (deletes all versions)
- [x] Version history view (VersionHistoryComponent slide-over)
- [x] Version change modal (patch/minor/major selection)
- [x] FPSO dropdown with auto-populated Field (from FPSO's field_name)
- [x] Teal focus styling for form inputs (per STYLING_GUIDE.md)
- [ ] Version comparison view (deferred)
- [ ] Restore old version (deferred)
- [x] **Tests:** ContractFormComponent, ContractService, VersionService (254 tests total)

#### 3C - Vessel CRUD ✅
- [x] Create vessel form (VesselFormComponent)
- [x] Edit vessel form (creates new version via FastAPI)
- [x] Fuel consumption inputs (nested FormGroup)
- [x] Outchartering config (toggle pattern with nested FormGroup)
- [x] Copy vessel (new entity with version 0.1.0)
- [x] Delete vessel (deletes all versions)
- [x] Version history view (VesselVersionHistoryComponent)
- [ ] Version comparison view (deferred)
- [ ] Restore old version (deferred)
- [x] **Tests:** VesselFormComponent (26 tests), VesselService (11 tests) - 291 total

#### 3D - Sharing ✅
- [x] Share model (types and interfaces)
- [x] Share service with two-step query pattern (getSharesForEntity, addShare, removeShare, updateAccessLevel, getAllUsers)
- [x] Share dialog component (reusable across entities)
- [x] Add user with access level (read-only/read-write via dropdown)
- [x] Remove sharing (with inline delete button)
- [x] Update access level (inline dropdown)
- [x] View who has access (list with user initials, name, email)
- [x] Owner-only restriction (Share button disabled for non-owners)
- [x] Integration in ContractDetailComponent, VesselDetailComponent, LocationDetailComponent
- [x] **Tests:** ShareService (15 tests), ShareDialogComponent (17 tests) - 331 total
- [ ] **RLS Tests:** Sharing access levels (read-only vs read-write) - deferred to Phase 10

#### 3E - Location CRUD ✅
- [x] Create location form (with type selection: FPSO, STS, Bunkering, etc.)
- [x] Edit location form (creates new version via FastAPI)
- [x] Coordinates input (lat/lng with manual entry)
- [x] FPSO-specific fields (field_name, storage capacity, production rate, allowed load volumes, loading rate)
- [x] STS-specific fields (discharge rate)
- [x] Tags input
- [x] Copy location (new entity with version 0.1.0)
- [x] Delete location (deletes all versions)
- [x] Version history view (slide-over panel)
- [ ] Version comparison view - deferred
- [x] Restore old version
- [x] **Tests:** LocationFormComponent, LocationService, LocationVersionHistoryComponent - 382 total

#### 3F - Export Vessel Config CRUD ✅
- [x] Create config form (name, vessel type, capacity, demurrage settings)
- [x] Edit config form (creates new version via FastAPI)
- [x] Manage allowed locations (AllowedLocationManagerComponent with add/remove)
- [x] Copy config (new entity with version 0.1.0)
- [x] Delete config (deletes all versions)
- [x] Version history view (slide-over panel)
- [ ] Version comparison view (deferred)
- [ ] Restore old version (deferred)
- [x] **Tests:** ConfigFormComponent (23 tests), ConfigDetailComponent (21 tests), ExportVesselConfigService (23 tests)

---

### Phase 4: Portfolio (Basic)

#### 4A - Portfolio List ✅
- [x] Portfolio list page (PortfolioListComponent)
- [x] Filter by type (Base-Portfolio/Scenario)
- [x] Filter by state (Incomplete, Ready, Running, Success, Error, etc.)
- [x] "My Portfolios" / "Shared with Me" tabs with counts
- [x] Search by name/description
- [x] Create new portfolio button (navigate to /portfolios/new)
- [x] Navigation to detail (/portfolios/:id)
- [x] Portfolio model with enums (PortfolioType, PortfolioState) and labels
- [x] PortfolioService with two-step shares query pattern
- [x] Badge variants for type (primary/info) and state (success/error/warning/info/default)
- [x] **Tests:** PortfolioService (25 tests), PortfolioListComponent (25 tests) - 471 tests total

#### 4B - Portfolio Edit - Basic Data ✅
- [x] Portfolio name, description
- [x] Time window (start/end)
- [x] Tags
- [x] Refuelling location select (bunkering locations)
- [x] Abroad location select (abroad position locations)
- [x] Calculation settings (runtime, gap)
- [x] Max demurrage days
- [x] Additional operations time
- [x] Reference country select
- [x] Copy portfolio (new with queryParams)
- [x] Version history view (PortfolioVersionHistoryComponent)
- [x] **Tests:** PortfolioFormComponent (44 tests), PortfolioDetailComponent (32 tests) - 549 tests total

#### 4C - Portfolio Edit - Add Vessels ✅
- [x] "Add from Base Data" modal (VesselSelectModalComponent with multi-select)
- [x] Vessel table with expandable rows (FleetSectionComponent)
- [x] Set availability window (start/end dates)
- [x] Set start location, date, initial cargo, fuel (inline editing)
- [x] Remove vessel from portfolio (with confirmation)
- [x] Local vessel indicator badge
- [x] Read-only fleet display in PortfolioDetailComponent
- [x] PortfolioVesselService with CRUD operations
- [x] LocationService.getStartLocations() for FPSO/STS dropdown
- [ ] "Create New" option (local only) - deferred
- [x] **Tests:** FleetSectionComponent (20 tests), VesselSelectModalComponent (12 tests), PortfolioVesselService (15 tests) - 596 tests total

#### 4D - Portfolio Edit - Vessel Events ✅
- [x] Add vessel event (DryDocking/AcceptanceTests)
- [x] Set laycan (time_window_start/end), duration, location
- [x] Edit/delete events (VesselEventManagerComponent with inline add/edit)
- [x] Location filtering by event type (DryDocking → DryDocking locations, AcceptanceTests → FPSO locations)
- [x] PortfolioVesselEventService with CRUD and batch fetching (getEventsForVessels)
- [x] Integration in FleetSectionComponent expanded rows
- [x] **Tests:** VesselEventManagerComponent (15 tests), PortfolioVesselEventService (9 tests), FleetSection integration (6 tests) - 639 tests total

#### 4E - Portfolio Edit - Add Contracts ✅
- [x] "Add from Base Data" modal (ContractSelectModalComponent with multi-select checkboxes)
- [x] Contract expandable rows (ContractsSectionComponent with chevron expand/collapse)
- [x] Edit cargos within portfolio (PortfolioCargoManagerComponent with inline CRUD)
- [x] Highlight cargos outside time window (amber warning with AlertTriangle icon)
- [x] Remove contract from portfolio (with confirmation dialog)
- [x] Read-only contracts display in PortfolioDetailComponent
- [x] PortfolioContractService (getContractsForPortfolio, addFromBaseData, remove)
- [x] PortfolioCargoService (getCargosForContract, getCargosForContracts batch, CRUD)
- [ ] "Create New" option (local-only contract) - deferred
- [x] **Tests:** ContractsSectionComponent (27 tests), ContractSelectModalComponent (28 tests), PortfolioCargoManagerComponent (32 tests), PortfolioContractService (11 tests), PortfolioCargoService (16 tests) - 753 tests total

#### 4F - Portfolio Edit - Discharge Info ✅
- [x] Select STS discharge locations (DischargeLocationSelectModalComponent with multi-select)
- [x] View export vessel configs (read-only table)
- [x] Add export vessel instances (inline CRUD with form validation)
- [x] Set instance name, config, availability (availability date validation against portfolio time window)
- [x] Remove instances (with confirmation)
- [x] PortfolioDischargeLocationService (junction table CRUD)
- [x] PortfolioExportVesselInstanceService (instance CRUD)
- [x] LocationService.getSTSLocations(), getMySTSLocations(), getSharedSTSLocations()
- [x] Read-only discharge info display in PortfolioDetailComponent
- [x] **Tests:** DischargeSectionComponent (30 tests), DischargeLocationSelectModalComponent (20 tests), PortfolioDischargeLocationService (13 tests), PortfolioExportVesselInstanceService (13 tests) - 829 tests total

#### 4G - Portfolio RLS Tests ✅
- [x] Write RLS tests for portfolios (owner, shared access)
- [x] Write RLS tests for portfolio_vessels, portfolio_contracts
- [x] Write RLS tests for portfolio_cargos, portfolio_vessel_events
- [x] Write RLS tests for portfolio_discharge_locations, portfolio_export_vessel_instances
- [x] Permission matrix: ISO (tenant isolation), SHA (sharing), CTW (cross-tenant write), INH (inherited), ADM (admin), ESC (escalation)
- [x] Documented security finding: FOR ALL policies on child tables allow read_only users to write (portfolio_vessel_events, portfolio_cargos)
- [x] **Tests:** portfolios.test.ts (18 tests), portfolio-vessels.test.ts (26 tests), portfolio-contracts.test.ts (32 tests) - 164 RLS tests total (9 files)

---

### Phase 5: Sync & Validation

#### 5A - Sync Status Display ✅
- [x] Sync status badge component (🔗 ⚠️ 📝 ❌)
- [x] Display on each portfolio item (FleetSection, ContractsSection, PortfolioDetail)
- [x] Calculate status from base_data_id + versions (SyncStatusService)
- [x] **Tests:** SyncStatusBadgeComponent (22 tests), SyncStatusService (14 tests)

#### 5B - FastAPI Sync Endpoints ✅
- [x] POST /api/sync/diff (diff calculation for preview)
- [x] POST /api/sync/into (pull from Base Data)
- [x] POST /api/sync/from (push to Base Data)
- [x] Batch sync support (via item_ids parameter)
- [x] Cargo sync strategy: REPLACE (delete existing, copy fresh)
- [x] Pydantic models: SyncDiffRequest/Response, SyncIntoRequest, SyncFromRequest, SyncResult
- [x] Sync service with field mapping (VESSEL_SYNC_FIELDS, CONTRACT_SYNC_FIELDS)
- [x] Portfolio-specific fields preserved (availability_start/end, start_location_id, etc.)
- [x] **Tests:** 18 pytest tests for sync service (31 backend tests total)

#### 5C - Sync UI ✅
- [x] Sync Into button with diff preview modal (SyncDiffModalComponent)
- [x] Sync From button with warning modal (SyncFromWarningModalComponent)
- [x] Sync All Into button (header action for out-of-sync items)
- [x] Visual feedback on sync complete (ToastService, ToastComponent)
- [x] SyncService (frontend) with getDiff, syncInto, syncFrom methods
- [x] Integration in FleetSectionComponent (vessels)
- [x] Integration in ContractsSectionComponent (contracts)
- [x] Change type selector (patch/minor/major) for Sync From mode
- [x] **Tests:** SyncService (6 tests), SyncDiffModalComponent (30 tests), SyncFromWarningModalComponent (14 tests), ToastService (9 tests), ToastComponent (7 tests) - 970 frontend tests total

#### 5D - Portfolio Validation ✅
- [x] POST /api/portfolio/validate endpoint
- [x] POST /api/portfolio/validate-and-ready endpoint (validate + state transition)
- [x] 10 validation rules: vessels, contracts, discharge info, locations, settings
- [x] Check required fields (has_vessels, has_contracts, has_discharge_locations, etc.)
- [x] Return issues list with severity (error/warning), category, suggestions
- [x] Frontend ValidationService with validatePortfolio, validateAndMarkReady methods
- [x] ValidationChecklistComponent modal with category sections, issue details
- [x] ValidationStatusBadgeComponent for quick status display
- [x] State transitions (Incomplete → CalculationReady when "Mark as Ready" clicked)
- [x] Integration in PortfolioDetailComponent with "Check Readiness" button
- [x] **Tests:** 31 backend pytest tests (62 total), 1030 frontend tests (29 ValidationChecklist, 19 ValidationStatusBadge, 6 ValidationService)

---

### Phase 6: Optimization

See also: `x_crude_worker_architecture.md` for detailed worker implementation.

#### 6A - Optimization Trigger ✅
- [x] "Save and Optimise" button in portfolio form (opens validation modal)
- [x] Validation modal with customizable actionLabel ("Save and Optimise")
- [x] validationPassed output for "Save and Optimise" flow (emits response instead of calling backend)
- [x] POST /api/version/create-with-optimise endpoint (creates MAJOR version with state=CalculationReady)
- [x] Version service createVersionAndOptimise() method
- [x] Always creates MAJOR version bump (no version modal needed)
- [x] Worker polls Supabase for portfolios with state=CalculationReady (already implemented)
- [x] Worker picks up job and sets state to CalculationRunning → CalculationSuccess
- [x] **Tests:** ValidationChecklistComponent (35 tests), backend version tests (27 tests), calculation tests (20 tests) - 1035 frontend tests total

#### 6B - Real-time Monitoring UI ✅
- [x] Subscribe to portfolio state changes (Supabase Realtime)
- [x] Subscribe to optimization_logs inserts (Supabase Realtime)
- [x] Live metrics display (Elapsed, Gap%, Objective, Nodes)
- [x] Live log stream panel (scrolling terminal style)
- [x] Progress bar (100% - gap%)
- [x] Handle state transitions (Ready → Running → Success/Error)
- [x] **Tests:** OptimizationLivePanelComponent (65 tests), OptimizationLogsService, PortfolioStateService - 1106 frontend tests total

#### 6C - Optimization Status ✅
- [x] Show loading UI while CalculationRunning
- [x] Handle: success, error, timeout, infeasible
- [x] Auto-refresh results on completion
- [x] Show error messages on failure
- [x] View historical logs after completion
- [x] **Tests:** OptimizationStatusComponent (59 tests), OptimizationLogsModalComponent (39 tests), OptimizationResultsService (8 tests), portfolio-detail integration (15 new tests) - 1224 frontend tests total

#### 6D - Results Display ✅ (Refactored to dedicated page in 6E)
- [x] Results slide-over panel (OptimizationResultsComponent) - later refactored to SolutionsPageComponent
- [x] Key metrics cards (fleet utilization, total volume, voyages, cargos scheduled)
- [x] Open cargos table with scheduling reasons (OpenCargosTableComponent)
- [x] Open vessel events table with reasons (OpenEventsTableComponent)
- [x] Voyages by vessel accordion with legs timeline (VoyagesListComponent)
- [x] Volume by month/field CSS bar charts (VolumeChartsComponent)
- [x] "View Full Results" button in OptimizationStatusComponent (success state only)
- [x] Tabs navigation (Voyages, Open Cargos, Open Events, Volume Analysis)
- [x] **Tests:** 6 new component specs (~75 tests), OptimizationStatusComponent integration (8 tests) - 1352 frontend tests total

#### 6E - Solutions Page ✅
- [x] Dedicated solutions page at `/portfolios/:id/solutions` (replaces slide-over panel)
- [x] SolutionsPageComponent with dark gradient header, back navigation, state badge
- [x] Left sidebar with output style selector (List View active, Gantt/Schedule "Coming Soon")
- [x] Reused existing results components (metrics, voyages, open cargos, open events, volume charts)
- [x] Direct URL access (bookmarkable)
- [x] "Back to Portfolio" navigation
- [x] **E2E Tests:** All 8 Part 4 user stories passing (US-27 to US-34) via Playwright MCP

#### 6F - Optimization RLS Tests ✅
- [x] RLS tests for optimization_results (via portfolio access)
- [x] RLS tests for optimization_logs (SELECT only, via portfolio)
- [x] **Tests:** 20 new RLS tests in `/tests/rls/optimization.test.ts` (184 total)

---

### Phase 7: AI Chat

**Prerequisite:** Phase 6 must be complete (Results Display needed for full context)

**Architecture:** See `docs/x_crude_chat_architecture.md` for detailed specifications

#### 7A - FastAPI Chat Endpoint ✅
- [x] POST /api/chat with SSE streaming response
- [x] Anthropic SDK with Claude Opus 4.5 (`claude-opus-4-5-20251101`)
- [x] **Extended thinking enabled** with 4000 token budget (applies to every response)
- [x] JWT authentication via Supabase token (ES256 validation using `auth.get_user()`)
- [x] **Create/update conversation** on first message (insert into chat_conversations)
- [x] **Save user message** to chat_messages before calling Claude
- [x] **Save assistant response** to chat_messages after Claude responds (includes token counts)
- [x] Error handling (API failures, authentication errors)
- [x] Database migration for chat tables (chat_conversations, chat_messages with RLS)
- [x] **Tests:** pytest - 27 tests (JWT auth, models, services, SSE streaming, extended thinking)

#### 7B - Chat Tools (Portfolio Context) - INPUT-focused ✅
- [x] `get_complete_portfolio_inputs` - **RECOMMENDED:** Complete portfolio in 1 call (vessels+events, contracts+cargos, discharge locations, export instances, summary)
- [x] `get_portfolio_overview` - High-level snapshot (vessels, contracts, cargos, validation)
- [x] `get_portfolio_vessels` - All vessels with availability, capacity, events
- [x] `get_portfolio_contracts` - All contracts with cargo counts, sync status
- [x] `get_portfolio_cargos` - Filterable by contract, date range, status
- [x] `get_vessel_details` - Single vessel deep dive with events
- [x] `get_contract_details` - Single contract with all cargos
- [x] `get_capacity_summary` - Fleet vs demand analysis, bottleneck detection
- [x] `get_validation_status` - Portfolio validation check
- [x] **Tests:** 16 tool tests + 146 total backend tests passing

#### 7C - Chat UI ✅
- [x] Floating chat button (bottom-right, 56px, with suggestion badge)
- [x] Slide-in chat panel (400px width, full height)
- [x] Streaming text display (word-by-word via SSE)
- [x] Message history persisted per user (not session-only)
- [x] Suggestion cards with Accept/Dismiss buttons
- [x] Typing indicator (three bouncing dots)
- [x] Tool call display (collapsible with name, input, result)
- [x] Mobile responsive (full-screen <768px, calc(100%-80px) tablet, 400px desktop)
- [x] Keyboard shortcut (Cmd/Ctrl+K to toggle panel)
- [x] Integration in LayoutShellComponent
- [x] **Tests:** ChatService (62 tests), ChatPanelComponent (42 tests), ChatButtonComponent (16 tests), SuggestionCardComponent (24 tests) - 144 chat tests total, 1555 frontend tests total

#### 7D - Results Tools (requires Phase 6D) ✅
- [x] `get_complete_portfolio_outputs` - **RECOMMENDED:** Complete results in 1 call (voyages+legs, open cargos+reasons, analytics)
- [x] `get_optimization_results` - Summary of optimization run
- [x] `get_voyages_for_vessel` - Planned journeys for vessel
- [x] **Tests:** 10 new tool tests - 156 backend tests total

#### 7E - Thinking Display + Chat Suggestions Table ✅
- [x] `chat_suggestions` table (suggestion lifecycle tracking) - Note: chat_conversations + chat_messages already exist from 7A
- [x] `thinking_content` column on `chat_messages` (persist AI reasoning)
- [x] RLS policies for `chat_suggestions` (conversations + messages already have RLS from 7A)
- [x] Indexes for `chat_suggestions`
- [x] Frontend: `ThinkingBlockComponent` (collapsible, minimized by default)
- [x] Frontend: Enable thinking display in ChatService
- [x] Backend: Accumulate + save thinking content
- [x] **Tests:** 10 ThinkingBlockComponent tests, 2 backend thinking tests - 158 backend tests, 166 chat tests total
- [ ] **Tests:** RLS tests for chat tables (deferred)

---

### ~~Phase 8: Scenarios~~ (REMOVED)

> **Decision (Jan 2026):** Scenarios feature removed to simplify codebase. The feature was scaffolded but never implemented - only a `portfolio_type` enum and unused `parent_portfolio_id` column existed. Can be re-added in ~1-2 days if users request "what-if" analysis capability. Database enum left as-is (harmless).

---

### Phase 9: Admin

#### 9A - User Management
- [ ] User list page
- [ ] Invite user (email)
- [ ] POST /api/invite endpoint (send email)
- [ ] Change user role
- [ ] Deactivate user
- [ ] **Tests:** UserManagementComponent, UserService
- [ ] **RLS Tests:** Admin-only access to user management, ESC (escalation prevention)

---

### Phase 10: Polish & Final Testing

#### 10A - Error Handling
- [ ] Global error interceptor
- [ ] Toast notifications
- [ ] Retry logic for network errors
- [ ] Graceful degradation

#### 10B - Performance
- [ ] Lazy loading for feature modules
- [ ] Virtual scrolling for large tables
- [ ] Debounce search inputs

#### 10C - Shared Component Tests
- [ ] DataTableComponent tests
- [ ] ExpandableRowComponent tests
- [ ] TagInputComponent tests
- [ ] ConfirmationDialogComponent tests
- [ ] LoadingSpinnerComponent tests
- [ ] EmptyStateComponent tests

#### 10D - Complete RLS Permission Matrix
- [ ] Tenant isolation (ISO-*) tests
- [ ] Escalation prevention (ESC-*) tests
- [ ] Cross-tenant write (CTW-*) tests
- [ ] Verify all tables covered
- [ ] Document security invariants

#### 10E - Test Coverage Review
- [ ] Ensure all services have tests
- [ ] Ensure all major components have tests
- [ ] Review and fix any failing tests
- [ ] Generate coverage report
- [ ] Document any intentional gaps

---

## 4. FastAPI Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/version/create` | POST | Create new version of entity |
| `/api/sync/into` | POST | Pull Base Data changes into Portfolio |
| `/api/sync/from` | POST | Push Portfolio changes to Base Data |
| `/api/sync/diff` | POST | Get diff preview before sync |
| `/api/portfolio/validate` | POST | Validate portfolio completeness |
| `/api/chat` | POST | AI chat with context |
| `/api/invite` | POST | Send user invitation email |

Note: Optimization is triggered by setting portfolio state in Supabase. Worker polls directly.

---

## 5. Supabase Direct Operations (from Angular)

| Operation | Table(s) | Notes |
|-----------|----------|-------|
| Login/Logout | auth | Supabase Auth |
| Reset Password | auth | Supabase Auth |
| List Contracts | contracts | WHERE is_latest = true |
| Get Contract | contracts | By version_id |
| Create Contract | contracts | Insert with version 0.1.0 |
| Update Contract | contracts | Via FastAPI (versioning) |
| List Cargos | cargos | By contract_version_id |
| CRUD Cargos | cargos | Direct |
| List Vessels | vessels | WHERE is_latest = true |
| List Locations | locations | WHERE is_latest = true |
| List Portfolios | portfolios | WHERE is_latest = true |
| Get Portfolio | portfolios | With all child tables |
| CRUD Portfolio Items | portfolio_* | Direct |
| List Shares | shares | By entity |
| CRUD Shares | shares | Direct |
| Get Results | optimization_results | By portfolio_version_id |
| Trigger Optimization | portfolios | Set state=CalculationReady |
| Poll Optimization Status | portfolios | Check state field |

---

## 5.1 Supabase Realtime Subscriptions

Angular subscribes to real-time changes for live updates:

| Subscription | Table | Filter | Purpose |
|-------------|-------|--------|---------|
| Portfolio State | portfolios | `version_id=eq.{id}` | Optimization status changes |
| Optimization Logs | optimization_logs | `portfolio_version_id=eq.{id}` | Live Gurobi progress |

**Enable Realtime in Supabase:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE portfolios;
ALTER PUBLICATION supabase_realtime ADD TABLE optimization_logs;
```

---

## 6. Environment Variables

### 6.1 FastAPI (.env)

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Email
RESEND_API_KEY=re_xxx
FROM_EMAIL=noreply@x-crude.app

# Worker (if needed)
WORKER_URL=https://worker.x-crude.app
```

### 6.2 Angular (environment.ts)

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://xxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
  apiUrl: 'http://localhost:8000/api',
};
```

---

## 7. RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | All | Auto (trigger) | Own | - |
| countries | All | - | - | - |
| shares | Own + Received | Owner | - | Owner |
| contracts | Own + Shared | Own | Own + Shared(RW) | Own |
| cargos | Via Contract | Via Contract | Via Contract | Via Contract |
| vessels | Own + Shared | Own | Own + Shared(RW) | Own |
| locations | All | Own | Own | Own |
| export_vessel_configs | All | Own | Own | Own |
| portfolios | Own + Shared | Own | Own + Shared(RW) | Own |
| portfolio_* | Via Portfolio | Via Portfolio | Via Portfolio | Via Portfolio |
| optimization_results | Via Portfolio | Via Portfolio | Via Portfolio | Via Portfolio |

**Admin Override:** Admins bypass all RLS via `is_admin()` function.

---

## 8. Important Notes

### 8.1 No Public Registration

Users cannot register themselves. Flow:
1. Admin invites user via email
2. User receives email with invite link
3. User sets password and completes profile
4. User can now login

### 8.2 Versioning is Backend-Controlled

Never create versions directly from Angular. Always go through FastAPI:
- Ensures atomic is_latest flag updates
- Ensures correct version bump
- Ensures audit trail

### 8.3 AI Chat Context

Chat context includes:
- Current view (results, edit, etc.)
- Current portfolio ID
- Selected items (if any)
- User role

Chat should feel natural, not require special syntax.

### 8.4 Optimization Worker is Separate

The optimization worker:
- Runs on Hetzner
- Polls Supabase for portfolios with state=CalculationReady
- Reads input data from Supabase directly
- Writes results to Supabase directly
- Sets portfolio state (CalculationRunning → Success/Error/etc.)
- Is NOT part of this development scope
- No FastAPI endpoints needed for optimization

### 8.5 Mobile Support

Desktop-first, but must work on mobile:
- Collapsible sidebar
- Responsive tables (horizontal scroll or card view)
- Touch-friendly buttons
- Chat panel full-screen on mobile

---

## 9. Shared Components

Build these early, use everywhere:

| Component | Purpose |
|-----------|---------|
| `DataTableComponent` | Sortable, searchable, paginated table |
| `ExpandableRowComponent` | Collapsible row with nested content |
| `TagInputComponent` | Add/remove tags |
| `SyncStatusBadgeComponent` | 🔗 ⚠️ 📝 ❌ badges |
| `VersionBadgeComponent` | Version display with history link |
| `ConfirmationDialogComponent` | "Are you sure?" dialogs |
| `LoadingSpinnerComponent` | Consistent loading states |
| `EmptyStateComponent` | "No data" messages |
| `ToastService` | Success/error/info toasts |

---

## 10. Testing Strategy

### 10.1 Overview

| Test Type | Technology | Location | When to Run |
|-----------|------------|----------|-------------|
| Frontend Unit | Vitest + @testing-library/angular | `frontend/src/**/*.spec.ts` | During development |
| RLS/Database | Vitest + Supabase Branches | `tests/**/*.test.ts` | Before merges |
| FastAPI Unit | pytest | `backend/tests/` | During development |

### 10.2 Frontend Testing

**Technology Stack:**
- Vitest (test runner)
- @testing-library/angular (component rendering)
- @analogjs/vite-plugin-angular (Vite support)
- vi.fn() for mocking

**NPM Scripts:**
```bash
cd frontend
npm test                    # Run once (vitest)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
npm run test:ui             # Interactive browser UI
```

**vitest.config.mts:**
```typescript
import { defineConfig } from 'vitest/config';
import analog from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [analog()],
  test: {
    globals: true,                    // describe, it, expect without imports
    environment: 'jsdom',             // Browser-like DOM
    include: ['src/**/*.spec.ts'],
    pool: 'forks',                    // Isolated process per test file
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

**test-setup.ts:**
```typescript
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Initialize Angular TestBed with Zone.js support
setupTestBed({ zoneless: false });
```

**Key Files:**
- `frontend/vitest.config.mts` - Test configuration
- `frontend/src/test-setup.ts` - Angular TestBed initialization
- `frontend/src/app/__mocks__/` - Service mocks

**Supabase Mock (Most Important):**
```typescript
// frontend/src/app/__mocks__/supabase.mock.ts

export function createMockSupabaseService() {
  // Query builder with method chaining
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve) => resolve({ data: [], error: null }))
  };

  return {
    client: {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })
    },
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),

    // Test helpers
    _mockQueryBuilder: mockQueryBuilder,
    _mockQueryResponse: (data, error = null) => {
      mockQueryBuilder.then.mockImplementationOnce((resolve) => resolve({ data, error }));
    },
    _resetMocks: () => {
      Object.values(mockQueryBuilder).forEach(fn => fn.mockClear?.());
    }
  };
}
```

**Mock Factory Pattern (All mocks follow this):**
```typescript
import { vi, type Mock } from 'vitest';

// All mocks export factory + type
export function createMockSupabaseService() { /* ... */ }
export type MockSupabaseService = ReturnType<typeof createMockSupabaseService>;

// Usage in tests - inline mock objects with vi.fn()
let mockService: { getItems: Mock; createItem: Mock };

beforeEach(() => {
  mockService = {
    getItems: vi.fn().mockResolvedValue([]),
    createItem: vi.fn().mockResolvedValue({ id: '1' })
  };
});
```

**Component Test Pattern:**
```typescript
import '../../../../test-setup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { ContractListComponent } from './contract-list.component';
import { ContractService } from '../services/contract.service';
import { ToastService } from '../../../shared/services/toast.service';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { provideLucideIcons } from '../../../__mocks__/lucide.mock';

describe('ContractListComponent', () => {
  // Data factory
  function createMockContract(overrides?: Partial<Contract>): Contract {
    return {
      id: 'contract-1',
      name: 'Test Contract',
      ownership_type: 'Equity',
      is_latest: true,
      ...overrides
    };
  }

  // Mock service factory
  function createMockContractService() {
    return {
      getContracts: vi.fn().mockResolvedValue([]),
      deleteContract: vi.fn().mockResolvedValue(true)
    };
  }

  // Render helper
  async function renderComponent(options?: { contracts?: Contract[] }) {
    const mockContractService = createMockContractService();
    const mockToast = createMockToastService();

    mockContractService.getContracts.mockResolvedValue(options?.contracts ?? []);

    const result = await render(ContractListComponent, {
      providers: [
        provideRouter([]),
        provideLucideIcons(),
        { provide: ContractService, useValue: mockContractService },
        { provide: ToastService, useValue: mockToast }
      ]
    });

    // Wait for async loading
    await vi.waitFor(() => {
      result.fixture.detectChanges();
      expect(result.fixture.componentInstance.isLoading()).toBe(false);
    }, { timeout: 2000 });

    return { ...result, mockContractService, mockToast };
  }

  it('displays contracts', async () => {
    const contracts = [
      createMockContract({ name: 'Petrobras Contract' }),
      createMockContract({ id: 'c2', name: 'Equinor Contract' })
    ];

    await renderComponent({ contracts });

    expect(screen.getByText('Petrobras Contract')).toBeTruthy();
    expect(screen.getByText('Equinor Contract')).toBeTruthy();
  });
});
```

**Service Test Pattern:**
```typescript
import '../../../../test-setup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ContractService } from './contract.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';

describe('ContractService', () => {
  let service: ContractService;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [
        ContractService,
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });

    service = TestBed.inject(ContractService);
  });

  describe('getContracts', () => {
    it('returns contracts where is_latest = true', async () => {
      const mockContracts = [{ id: '1', name: 'Test' }];
      mockSupabase._mockQueryResponse(mockContracts);

      const contracts = await service.getContracts();

      expect(mockSupabase.from).toHaveBeenCalledWith('contracts');
      expect(mockSupabase._mockQueryBuilder.eq).toHaveBeenCalledWith('is_latest', true);
      expect(contracts).toEqual(mockContracts);
    });
  });
});
```

### 10.3 RLS Testing

**Why Branch-Based:**
Supabase Cloud is production. Tests run against isolated branches to avoid data corruption.

**NPM Scripts:**
```bash
npm run test:rls       # Full suite (creates branch, tests, cleanup)
npm run test:rls:local # Local only (requires env vars)
```

**Test Flow:**
1. Create Supabase branch (`supabase branches create test-run-{timestamp}`)
2. Wait for branch ready (poll until `preview_project_status === 'ACTIVE_HEALTHY'`)
3. Apply migrations via pg.Client (bypasses snapshot lag)
4. Get branch credentials (project_ref, anon_key, service_role_key)
5. Run tests against branch
6. Delete branch (always, even on failure, via finally block)

**Two Client Types:**
```typescript
// 1. Admin Client - Bypasses RLS (for test setup only)
export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// 2. Authenticated Client - RLS enforced
export async function createClientAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Real sign-in (branches have own JWT secrets)
  await client.auth.signInWithPassword({
    email: user.email,
    password: user.password
  });
  
  return client;
}
```

**Custom Matcher: toDenyAccess()**

| Operation | RLS Blocks | Supabase Returns | Detection |
|-----------|-----------|------------------|-----------|
| SELECT | Filters silently | `{ data: [], error: null }` | `data.length === 0` |
| INSERT | Returns error | `{ data: null, error: {...} }` | `error !== null` |
| UPDATE | 0 rows affected | `{ data: [], error: null }` | `data.length === 0` |
| DELETE | 0 rows affected | `{ data: [], error: null }` | `data.length === 0` |

**CRITICAL:** UPDATE/DELETE must chain `.select()` to detect 0 rows!

```typescript
// SELECT: denied if empty array
await expect(
  client.from('contracts').select('*').eq('id', otherOwnerId)
).toDenyAccess('select');

// INSERT: denied if error
await expect(
  client.from('contracts').insert({ name: 'Unauthorized', owner_id: otherOwnerId })
).toDenyAccess('insert');

// UPDATE: MUST chain .select() for row count!
await expect(
  client.from('contracts').update({ name: 'Hacked' }).eq('id', otherContractId).select()
).toDenyAccess('update');

// DELETE: same pattern
await expect(
  client.from('contracts').delete().eq('id', otherContractId).select()
).toDenyAccess('delete');
```

**Permission Matrix Categories:**
| Prefix | Name | Purpose | Example |
|--------|------|---------|---------|
| ISO | Tenant/Owner Isolation | Other owner's data invisible | Planner A cannot see Planner B's contracts |
| ESC | Escalation Prevention | No role self-elevation | Planner cannot make self admin |
| CTW | Cross-Tenant Write | Cannot write to other's data | Cannot insert cargo into other's contract |
| SHA | Sharing Access | Correct access via shares | Read-only share cannot update |

### 10.4 Test Factories

**Location:** `tests/setup.ts`

| Factory | Purpose |
|---------|---------|
| `createUser(role, overrides)` | Create auth.users + profiles entry |
| `createContract(ownerId, overrides)` | Create contract with version_id |
| `createCargo(contractVersionId, overrides)` | Create cargo for contract |
| `createVessel(ownerId, overrides)` | Create vessel with version_id |
| `createLocation(ownerId, overrides)` | Create location |
| `createPortfolio(ownerId, overrides)` | Create portfolio with version_id |
| `createPortfolioVessel(portfolioVersionId, overrides)` | Create portfolio vessel |
| `createPortfolioCargo(portfolioVersionId, overrides)` | Create portfolio cargo |
| `createShare(entityType, entityId, userId, level)` | Create share (read_only/read_write) |
| `cleanupTestData()` | Delete all test data (dependency order) |

**Factory Example:**
```typescript
export async function createContract(
  ownerId: string,
  overrides: Partial<Contract> = {}
): Promise<TestContract> {
  const id = faker.string.uuid();
  const versionId = faker.string.uuid();
  
  const contract = {
    id,
    version_id: versionId,
    owner_id: ownerId,
    name: overrides.name ?? faker.company.name() + ' Contract',
    ownership_type: overrides.ownership_type ?? 'Equity',
    version: '0.1.0',
    is_latest: true,
    ...overrides
  };

  const { data, error } = await adminClient
    .from('contracts')
    .insert(contract)
    .select()
    .single();

  if (error) throw new Error(`Failed to create contract: ${error.message}`);
  return data;
}
```

### 10.5 What to Test When

| Phase | Frontend Tests | RLS Tests |
|-------|----------------|-----------|
| 1 (Foundation) | Auth service, guards | profiles, shares |
| 2 (Base Data Read) | List/Detail components | contracts, vessels, locations (SELECT) |
| 3 (Base Data Write) | Edit components, services | CRUD operations, sharing (INSERT/UPDATE/DELETE) |
| 4 (Portfolio) | Portfolio components | portfolio_*, child tables |
| 5 (Sync) | Sync components, services | - |
| 6 (Optimization) | Live panel, results | optimization_results, logs |
| 7 (AI Chat) | Chat panel, service | - |
| 9 (Admin) | User management | Admin-only access, ESC |
| 10 (Polish) | Shared components | Complete permission matrix |

### 10.6 Permission Matrix Example

```typescript
// tests/access-matrix.test.ts

interface MatrixRow {
  id: string;                      // 'ISO-001', 'SHA-002', etc.
  description: string;
  role: 'admin' | 'planner';
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  expected: 'allow' | 'deny';
  setup?: {
    targetOwner?: 'self' | 'other';
    shareLevel?: 'read_only' | 'read_write' | 'none';
    filters?: Record<string, string>;
    payload?: Record<string, any>;
  };
}

const PERMISSION_MATRIX: MatrixRow[] = [
  // Owner Isolation
  {
    id: 'ISO-001',
    description: 'Planner A cannot see Planner B contracts',
    role: 'planner',
    table: 'contracts',
    action: 'select',
    expected: 'deny',
    setup: { targetOwner: 'other' }
  },
  
  // Sharing Access
  {
    id: 'SHA-001',
    description: 'Planner can read shared contract (read_only)',
    role: 'planner',
    table: 'contracts',
    action: 'select',
    expected: 'allow',
    setup: { targetOwner: 'other', shareLevel: 'read_only' }
  },
  {
    id: 'SHA-002',
    description: 'Planner cannot update shared contract (read_only)',
    role: 'planner',
    table: 'contracts',
    action: 'update',
    expected: 'deny',
    setup: { targetOwner: 'other', shareLevel: 'read_only' }
  },
  {
    id: 'SHA-003',
    description: 'Planner can update shared contract (read_write)',
    role: 'planner',
    table: 'contracts',
    action: 'update',
    expected: 'allow',
    setup: { targetOwner: 'other', shareLevel: 'read_write' }
  },
  
  // Escalation Prevention
  {
    id: 'ESC-001',
    description: 'Planner cannot update own role',
    role: 'planner',
    table: 'profiles',
    action: 'update',
    expected: 'deny',
    setup: {
      filters: { id: '{{plannerA.id}}' },
      payload: { role: 'admin' }
    }
  },
  
  // Cross-Tenant Write
  {
    id: 'CTW-001',
    description: 'Planner A cannot insert cargo into Planner B contract',
    role: 'planner',
    table: 'cargos',
    action: 'insert',
    expected: 'deny',
    setup: {
      payload: { contract_version_id: '{{otherContract.version_id}}' }
    }
  }
];
```

### 10.7 Testing Best Practices

**DO:**
- Write tests alongside feature code (not after)
- Use mock factories, not inline mocks
- Test component behavior, not implementation
- Use `screen.getByRole()` over `getByText()` when possible
- Test loading and error states
- Test RLS for all CRUD operations
- Chain `.select()` on UPDATE/DELETE for row count detection

**DON'T:**
- Skip tests "to save time"
- Test private methods directly
- Mock too much (keep some integration)
- Rely only on UI tests for security
- Forget to test shared access levels (read_only vs read_write)
- Use custom JWT signing (branches have own secrets)

### 10.8 Common Testing Gotchas

**Frontend (Vitest + @analogjs/vitest-angular):**
- Use `async/await` with `fixture.whenStable()` instead of `fakeAsync/tick` (Vitest Zone.js integration issue)
- Use `vi.fn().mockResolvedValue()` instead of `jasmine.createSpy().and.returnValue(Promise.resolve())`
- Tests using `TestBed.resetTestingModule()` must: (1) await `compileComponents()`, (2) provide all injected services as mocks
- Use `vi.spyOn(obj, 'method')` instead of `spyOn(obj, 'method')`
- Mock types: `{ methodName: Mock }` instead of `jasmine.SpyObj<Service>`

**RLS:**
- UPDATE/DELETE must chain `.select()` - otherwise can't detect 0 rows
- Branches have own JWT secrets - use `signInWithPassword()`, not custom JWT
- Apply migrations directly via pg.Client (snapshot lag workaround)
- `NULL = 'value'` returns NULL, not FALSE - watch NULL handling in policies

---

## 11. Checklist Summary

### Phase 1: Foundation
- [ ] Supabase setup + schema + RLS
- [ ] RLS test infrastructure setup
- [ ] FastAPI setup + deploy
- [ ] Angular setup + deploy
- [ ] Frontend test infrastructure setup
- [ ] Auth flow (login, invite, guards) + tests
- [ ] Layout shell + tests

### Phase 2: Base Data (Read) ✅
- [x] Contracts list + detail + tests ✅
- [x] Vessels list + detail + tests ✅
- [x] Locations list + detail + tests ✅
- [x] Export vessel configs + tests ✅
- [x] Base Data RLS tests ✅ (83 tests: contracts, vessels, locations, cargos)

### Phase 3: Base Data (Write) ✅
- [x] Version endpoint + tests ✅
- [x] Contract CRUD + tests ✅
- [x] Vessel CRUD + tests ✅
- [x] Sharing + tests ✅ (RLS tests deferred to Phase 10)
- [x] Location CRUD + tests (coordinates, FPSO/STS fields) ✅
- [x] Export Vessel Config CRUD + tests ✅

### Phase 4: Portfolio (Basic)
- [x] Portfolio list + tests ✅ (PortfolioService + PortfolioListComponent, 471 tests total)
- [x] Portfolio edit - Basic Data + tests ✅ (PortfolioFormComponent, PortfolioDetailComponent, 549 tests total)
- [x] Portfolio edit - Add Vessels + tests ✅ (FleetSectionComponent, VesselSelectModalComponent, 596 tests total)
- [x] Portfolio edit - Vessel Events + tests ✅ (VesselEventManagerComponent, PortfolioVesselEventService, 639 tests total)
- [x] Portfolio edit - Add Contracts + tests ✅ (ContractsSectionComponent, ContractSelectModalComponent, PortfolioCargoManagerComponent, 753 tests total)
- [x] Portfolio edit - Discharge Info + tests ✅ (DischargeSectionComponent, DischargeLocationSelectModalComponent, 829 tests total)
- [x] Portfolio RLS tests ✅ (76 new RLS tests across 3 files, 164 RLS tests total)

### Phase 5: Sync & Validation ✅
- [x] Sync status display + tests ✅ (SyncStatusBadgeComponent, SyncStatusService, 865 tests total)
- [x] Sync endpoints + tests ✅ (FastAPI: /api/sync/diff, /api/sync/into, /api/sync/from - 18 pytest tests, 31 backend tests total)
- [x] Sync UI + tests ✅ (SyncDiffModalComponent, SyncFromWarningModalComponent, ToastService, ToastComponent, FleetSection/ContractsSection integration - 970 frontend tests total)
- [x] Validation endpoint + UI + tests ✅ (POST /api/portfolio/validate, /api/portfolio/validate-and-ready, ValidationChecklistComponent, ValidationStatusBadgeComponent - 62 backend tests, 1030 frontend tests)

### Phase 6: Optimization ✅
- [x] Save and Optimise button → validation modal → set state ✅
- [x] Real-time monitoring UI + tests ✅ (OptimizationLivePanelComponent, OptimizationLogsService, PortfolioStateService - 1106 tests total)
- [x] Results display + tests ✅ (OptimizationResultsComponent → SolutionsPageComponent, 1352 tests total)
- [x] Solutions page (Phase 6E) + E2E tests ✅ (All 8 Part 4 user stories passing)
- [x] Optimization RLS tests (Phase 6F) ✅ (20 tests in optimization.test.ts, 184 RLS tests total)

### Phase 7: AI Chat
- [x] Chat endpoint + tests ✅ (POST /api/chat with SSE streaming, Claude Opus 4.5, extended thinking, JWT auth, 27 pytest tests)
- [x] Chat tools (read) + tests ✅ (9 portfolio tools: get_complete_portfolio_inputs, get_portfolio_overview, get_portfolio_vessels, get_portfolio_contracts, get_portfolio_cargos, get_vessel_details, get_contract_details, get_capacity_summary, get_validation_status - 146 backend tests)
- [x] Chat UI + tests ✅ (ChatService SSE streaming, ChatPanelComponent, ChatButtonComponent, SuggestionCardComponent, TypingIndicatorComponent, ToolCallDisplayComponent, ChatMessageComponent, mobile responsive - 144 chat tests, 1555 frontend tests total)
- [ ] Results tools (actions)

### ~~Phase 8: Scenarios~~ (REMOVED)

### Phase 9: Admin
- [ ] User management + tests + RLS tests
- [ ] Invite flow

### Phase 10: Polish & Final Testing
- [ ] Error handling
- [ ] Performance
- [ ] Shared component tests
- [ ] Complete RLS permission matrix
- [ ] Test coverage review

---

## 12. Getting Started

1. **Create Supabase project**
2. **Run SQL schema** from `x_crude_database_schema.sql`
3. **Configure auth** (email/password, disable registration)
4. **Enable Realtime** for portfolios + optimization_logs
5. **Create first admin user** manually in Supabase
6. **Note credentials** (URL, anon key, service role key, JWT secret)
7. **Setup RLS test infrastructure** (scripts/test-runner.ts, tests/setup.ts)
8. **Run initial RLS tests** to verify schema
9. **Create FastAPI project** (see Section 2 for structure)
10. **Configure FastAPI environment variables**
11. **Deploy FastAPI to Railway**
12. **Create Angular project**
13. **Setup frontend test infrastructure** (vitest, mocks, test-setup.ts)
14. **Configure Angular environment**
15. **Deploy Angular to Vercel**
16. **Begin Phase 1F** - Auth flow

---

## Revision History

| Date | Changes |
|------|---------|
| 2026-01-20 | Initial version |
| 2026-01-20 | Added Testing Strategy section, test infrastructure in project structure, testing checkboxes per phase |
| 2026-01-21 | Completed Phase 2E - Base Data RLS Tests (83 tests), added branch-based test runner |
| 2026-01-21 | Added Phase 3E (Location CRUD) and Phase 3F (Export Vessel Config CRUD) to development plan |
| 2026-01-21 | Completed Phase 3A (FastAPI Version Endpoint) - 13 pytest tests |
| 2026-01-21 | Completed Phase 3B (Contract CRUD) - FPSO dropdown, field auto-populate, cargo manager, version modal, history view |
| 2026-01-21 | Added field_name column to locations table (migration), FPSO → Oil Field relationship for contracts |
| 2026-01-21 | Completed Phase 3C (Vessel CRUD) - VesselFormComponent with nested FormGroups for fuel_consumption and outchartering_config, version history |
| 2026-01-21 | Completed Phase 3D (Sharing) - ShareService, ShareDialogComponent, owner-only restriction, 331 tests |
| 2026-01-21 | Completed Phase 3E (Location CRUD) - LocationFormComponent with conditional FPSO/STS sections, version history, 382 tests |
| 2026-01-21 | Completed Phase 3F (Export Vessel Config CRUD) - ConfigFormComponent with AllowedLocationManagerComponent, version history |
| 2026-01-21 | Migrated frontend tests from Karma/Jasmine to Vitest - 419 tests passing, removed Karma dependencies |
| 2026-01-21 | Completed Phase 4A (Portfolio List) - PortfolioService, PortfolioListComponent with tabs, filters, badges, 471 tests total |
| 2026-01-22 | Completed Phase 4B (Portfolio Edit - Basic Data) - PortfolioFormComponent, PortfolioDetailComponent with version history and sharing |
| 2026-01-22 | Completed Phase 4C (Portfolio Edit - Add Vessels) - FleetSectionComponent with expandable rows, VesselSelectModalComponent, PortfolioVesselService, 596 tests total |
| 2026-01-22 | Completed Phase 4D (Portfolio Edit - Vessel Events) - VesselEventManagerComponent with inline CRUD, PortfolioVesselEventService with batch fetching, location filtering by event type, 639 tests total |
| 2026-01-22 | Completed Phase 4E (Portfolio Edit - Add Contracts) - ContractsSectionComponent with expandable rows, ContractSelectModalComponent, PortfolioCargoManagerComponent with time window highlighting, 753 tests total |
| 2026-01-22 | Completed Phase 4F (Portfolio Edit - Discharge Info) - DischargeSectionComponent with STS locations, export configs (read-only), export vessel instances (inline CRUD), DischargeLocationSelectModalComponent, 829 tests total |
| 2026-01-22 | Completed Phase 4G (Portfolio RLS Tests) - 76 new RLS tests across portfolios.test.ts (18), portfolio-vessels.test.ts (26), portfolio-contracts.test.ts (32). Documented security finding: FOR ALL policies on child tables allow read_only writes. 164 RLS tests total (9 files) |
| 2026-01-22 | Completed Phase 5B (FastAPI Sync Endpoints) - POST /api/sync/diff, /api/sync/into, /api/sync/from. Pydantic models (sync.py), sync service with cargo sync (REPLACE strategy), router with 3 endpoints. 18 pytest tests, 31 backend tests total. 865 frontend tests passing |
| 2026-01-22 | Completed Phase 5C (Sync UI) - SyncDiffModalComponent (diff preview with field-by-field changes), SyncFromWarningModalComponent (push warning), ToastService + ToastComponent (success/error notifications), SyncService (frontend API client). Integrated into FleetSectionComponent and ContractsSectionComponent with Sync Into/From/All buttons. Change type selector for version bumps. 970 frontend tests total |
| 2026-01-22 | Completed Phase 5D (Portfolio Validation) - Backend: POST /api/portfolio/validate + /api/portfolio/validate-and-ready endpoints, 10 validation rules (vessels, contracts, discharge, locations, settings), Pydantic models (validate.py), validation service with state transition support. Frontend: ValidationService, ValidationChecklistComponent modal with category sections and "Mark as Ready" button, ValidationStatusBadgeComponent. Integration in PortfolioDetailComponent with "Check Readiness" button. 62 backend tests, 1030 frontend tests total |
| 2026-01-23 | Completed Phase 6A (Optimization Trigger) - "Save and Optimise" button in portfolio form opens validation modal. ValidationChecklistComponent enhanced with actionLabel input and validationPassed output. POST /api/version/create-with-optimise endpoint creates MAJOR version with state=CalculationReady. Version service createVersionAndOptimise() method. Always MAJOR version (skips version modal). Worker auto-picks up within 5 seconds. 1035 frontend tests, 47 backend tests total |
| 2026-01-23 | Completed Phase 6B (Real-time Monitoring UI) - OptimizationLivePanelComponent with live metrics (Elapsed, Gap%, Objective, Nodes), progress bar (100% - gap%), scrolling log stream with terminal styling. OptimizationLogsService and PortfolioStateService using Supabase Realtime subscriptions for portfolio state changes and optimization_logs inserts. Handles state transitions (CalculationReady → CalculationRunning → CalculationSuccess/Error/Timeout). Integration in PortfolioDetailComponent with stateChange and completed events. Fixed 35 pre-existing test failures (Zone.js timing with throwError()). 1106 frontend tests total (65 new tests for Phase 6B), 47 backend tests |
| 2026-01-23 | Completed Phase 6D (Results Display) - OptimizationResultsComponent (slide-over panel with tabs), ResultsMetricsCardComponent, VoyagesListComponent (accordion), OpenCargosTableComponent, OpenEventsTableComponent, VolumeChartsComponent (CSS bar charts). "View Full Results" button in OptimizationStatusComponent. 1352 frontend tests total (128 new tests for Phase 6D) |
| 2026-01-23 | Completed Phase 6E (Solutions Page) - Refactored slide-over panel to dedicated SolutionsPageComponent at `/portfolios/:id/solutions`. Dark gradient header with back navigation, left sidebar with output style selector (List/Gantt/Schedule), direct URL access (bookmarkable). Full E2E testing via Playwright MCP - all 8 Part 4 user stories passing (US-27 to US-34). Updated PLAYWRIGHT_USER_STORIES_PART4.md with Phase 6E changes |
| 2026-01-23 | Completed Phase 6F (Optimization RLS Tests) - Created `/tests/rls/optimization.test.ts` with 20 test cases: INH-OPT (owner/shared SELECT), CTW-OPT (cross-tenant prevention, write denial for logs), ADM-OPT (admin override). Added TestOptimizationResult, TestOptimizationLog interfaces and factory functions. Key verification: optimization_logs is SELECT-only (users cannot write, only worker via service role). 184 RLS tests total |
| 2026-01-24 | Completed Phase 7A (FastAPI Chat Endpoint) - POST /api/chat with SSE streaming, Anthropic SDK (Claude Opus 4.5), extended thinking (4000 token budget), JWT auth via Supabase client `auth.get_user()` (ES256 validation). Database migration for chat_conversations and chat_messages tables with RLS. ChatService with conversation persistence, system prompt building, message history. 27 pytest tests (JWT auth, models, services, SSE format). Production tested and verified |
| 2026-01-24 | Completed Phase 7B (Chat Tools - Portfolio Context INPUT-focused) - 9 portfolio tools: `get_complete_portfolio_inputs` (Tier 0 aggregate), `get_portfolio_overview`, `get_portfolio_vessels`, `get_portfolio_contracts`, `get_portfolio_cargos`, `get_vessel_details`, `get_contract_details` (Tier 1), `get_capacity_summary`, `get_validation_status` (Tier 2). Created `backend/app/tools/definitions.py` (Anthropic tool schemas), `backend/app/tools/portfolio.py` (tool implementations with location name resolution, batch fetching), updated `chat.py` with tool dispatch. 16 new tool tests, 146 total backend tests passing |
| 2026-01-24 | Completed Phase 7C (Chat UI) - Full chat panel implementation with SSE streaming. ChatService with fetch-based SSE (for JWT auth support), message state management, tool call tracking, suggestion handling. ChatPanelComponent (slide-in panel with messages, input, streaming display), ChatButtonComponent (floating FAB with suggestion badge), ChatMessageComponent (user/assistant bubbles), SuggestionCardComponent (Accept/Dismiss with status states), TypingIndicatorComponent (bouncing dots), ToolCallDisplayComponent (collapsible tool execution). Mobile responsive (full-screen <768px, calc(100%-80px) tablet, 400px desktop). Keyboard shortcut (Cmd/Ctrl+K). Integrated into LayoutShellComponent. 144 new chat tests, 1555 frontend tests total |
| 2026-01-24 | Completed Phase 7D (Results Tools - OUTPUT-focused) - 3 new tools for optimization results: `get_complete_portfolio_outputs` (Tier 0 aggregate with voyages, open cargos, analytics), `get_optimization_results` (summary metrics), `get_voyages_for_vessel` (vessel schedule). Added tool definitions and implementations in `backend/app/tools/`. 10 new tool tests, 156 backend tests total |
| 2026-01-24 | Completed Phase 7E (Thinking Display + Chat Suggestions) - Created `chat_suggestions` table with RLS policies, added `thinking_content` column to `chat_messages`. Backend accumulates + saves thinking content during streaming. Frontend `ThinkingBlockComponent` with collapsible purple-themed display (minimized by default), `ChatService` streams thinking, `ChatMessageComponent` renders thinking before tool calls. Migration applied to Supabase. 10 ThinkingBlockComponent tests, 2 backend thinking tests - 158 backend tests, 166 chat tests total |
