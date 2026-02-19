# Quote Calculator Redesign — Design Document

**Date:** 2026-02-19
**Approach:** Big Bang Rebuild
**Status:** Approved

---

## Overview

Restructure the Quote Calculator around a project-centric hierarchy with two distinct quoting modes (Retainer and Budget), percentage-based shot mix with auto-rebalancing sliders, Kantata integration for linking live projects, and an auditable status workflow.

## Hierarchy

```
Development → Projects → Quotes → Versions → Shots
```

- **Developments**: QuoteCalc-native groupings (e.g., "Dubai Islands E"). Not in Kantata.
- **Projects**: Either Kantata-linked (5-digit ID) or forecasted (no ID yet). Forecasted projects can be manually linked to Kantata when they go live.
- **Quotes**: Per-quote mode selection (retainer vs budget). Belong to a project.
- **Versions**: Immutable snapshots of a quote's shot breakdown.

---

## Data Model

### New Tables (`quote_calculator` schema)

#### `developments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | "Dubai Islands E" |
| client_name | text | Optional display-only |
| description | text | |
| created_by | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| development_id | uuid FK → developments | |
| name | text NOT NULL | "Masterplan Film 60s" |
| kantata_id | text UNIQUE | null if forecasted |
| status | text | Mirrored from Kantata or editable |
| is_forecasted | boolean DEFAULT true | false when linked |
| created_by | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `quotes` (restructured)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK → projects | Replaces client_name/project_name |
| mode | text NOT NULL | 'retainer' or 'budget' |
| status | text DEFAULT 'draft' | New enum (see below) |
| rate_card_id | uuid FK → rate_cards | |
| created_by | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `quote_status_log`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| quote_id | uuid FK → quotes | |
| old_status | text | null for initial creation |
| new_status | text NOT NULL | |
| changed_by | uuid NOT NULL | |
| changed_at | timestamptz DEFAULT now() | |

#### `quote_versions` (modified)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| quote_id | uuid FK | |
| version_number | int | |
| duration_seconds | int | |
| shot_count | int | NEW: ceil(duration/4) |
| pool_budget_hours | numeric | NULL for retainer mode |
| pool_budget_amount | numeric | NULL for retainer mode ($ value) |
| total_hours | numeric | |
| hourly_rate | numeric | From rate card, overridable |
| notes | text | |
| created_by | uuid | |
| created_at | timestamptz | |

#### `version_shots` (modified)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| version_id | uuid FK | |
| shot_type | text | |
| percentage | numeric | NEW: % of total shots |
| quantity | int | Calculated or manual override |
| base_hours_each | numeric | |
| efficiency_multiplier | numeric | |
| adjusted_hours | numeric | |
| sort_order | int | |

### Modified Tables

#### `rate_cards`
- Add: `hourly_rate numeric DEFAULT 125` — $/hr for pricing

#### `film_template_shots`
- Replace `quantity` with `percentage numeric NOT NULL` — % of total shots
- Keep: `shot_type`, `efficiency_multiplier`, `sort_order`

---

## Status System

### Enum Values
| Status | Color | Description |
|--------|-------|-------------|
| draft | Gray | Work in progress |
| negotiating | Amber | In discussion with client |
| awaiting_approval | Blue | Sent for sign-off |
| confirmed | Green | Client confirmed |
| archived | Muted | Retired/cancelled |

### Transitions
- Forward: draft → negotiating → awaiting_approval → confirmed
- Backward: any → draft (rework)
- Terminal: any → archived

### Audit Trail UI
Clickable status badge opens a popover showing chronological status history with user and timestamp per change.

---

## Homepage & Navigation

### Routes
| Route | Page |
|-------|------|
| `/` | ProjectsHomePage — two-card grid |
| `/projects/:id` | ProjectDetailPage — quotes list |
| `/projects/:id/quotes/:quoteId` | QuoteDetailPage — versions, status |
| `/projects/:id/quotes/:quoteId/versions/:versionId/build` | QuoteBuilderPage |
| `/rate-cards` | RateCardsPage |
| `/templates` | TemplatesPage (percentage-based) |
| `/settings` | SettingsPage |

### Homepage Layout
- **Top section: "Active Projects"** — Kantata-linked projects (`is_forecasted = false`)
- **Bottom section: "Forecasted Projects"** — no Kantata ID yet
- Search bar above both sections (name, development, Kantata ID)

### Creation Flow
1. "New Project" → pick/create Development → choose Kantata or forecasted → create
2. "New Quote" (on project page) → choose mode (retainer/budget) → select rate card → create → builder

---

## Quote Builder

### Mode Toggle
Prominent switch at top: **Retainer** | **Budget**
Second toggle: **Show Pricing** (on by default)

### Retainer Mode (No Pool)

1. **Duration**: Presets (15/30/45/60/90/120s) or custom. Auto-calculates shot count: `ceil(duration/4)`
2. **Template**: Apply percentage-based template or manual mix
3. **Sliders**: Each shot type gets a % slider. Auto-rebalance to 100%. Display: `40% → 6 shots → 24.0 hrs ($3,000)`
4. **Manual override**: +/- buttons on quantity break auto-balance for that shot
5. **Summary**: Total shots, total hours, total cost (if pricing on). No pool bar.

### Budget Mode (With Pool)

1. **Budget**: Enter $ amount or hours. Rate from rate card (e.g., $125/hr). Pool = budget / rate.
2. **Duration + Sliders**: Same as retainer
3. **Pool bar**: Green/amber/red progress bar. Shows hours + $ used vs pool.
4. **Suggestions**: Remaining budget → suggested shots to fill it.

### Shot Count Formula
```
total_shots = ceil(duration_seconds / 4)
```
Key outcomes: 15s→5, 30s→8, 45s→12, 60s→15, 90s→23

### Percentage → Quantity Rounding
Largest-remainder method with bias toward higher-hour shot types:
1. Calculate raw: `total_shots * (percentage / 100)` for each type
2. Floor all values
3. Distribute remaining shots to types with largest fractional remainders
4. Tie-break: allocate to higher-hour shot type (commercially safer)
5. Result: integer quantities summing to exactly `total_shots`

---

## Templates (Percentage-Based)

### Built-in Presets
| Template | Mix |
|----------|-----|
| Masterplan Film | 20% Masterplan Aerial, 40% Aerial, 40% Exterior Eye-Level |
| Community Film | 25% Aerial, 25% Semi-Aerial, 50% Exterior Eye-Level |
| Product Film | 20% Aerial, 20% Exterior Eye-Level, 60% Interior |

### Template UI
- Shot rows show percentage (must sum to 100%)
- Preview: example shot counts for a reference duration
- Admin creates/edits custom templates

---

## Kantata Integration (Read-Only)

### Endpoint
`GET /api/kantata/workspaces?search=<term>` — queries `traffic_light.kantata_workspaces` cross-schema

### Linking Flow
`POST /api/projects/:id/link` with `{ kantata_id }` — sets kantata_id, flips is_forecasted

### UI
"Link to Kantata" button on forecasted project → search dialog → select workspace → confirm

---

## Pricing

- `hourly_rate` on rate card (default $125)
- Toggle in builder shows/hides $ values
- Every hours display gets a $ equivalent: `24.0 hrs ($3,000)`
- Budget mode: pool shown in both hours and $
- Pricing is display-only — no payment integration
