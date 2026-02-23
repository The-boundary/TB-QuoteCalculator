# MC-QuoteCalculator

Film production quote calculator for estimating hours and costs per shot type.

## Architecture

Monorepo with npm workspaces: `client/`, `server/`, `shared/`.

- **Client**: React 19, Vite 5, TanStack Query 5, Zustand 5, Tailwind 3, Radix UI
- **Server**: Express 4, Node 20, Zod validation, Pino logger
- **Shared**: TypeScript type definitions only (no runtime code)
- **Single container**: Express serves the Vite SPA as static files and handles `/api/*`

## Dev Setup

```bash
npm install
npm run dev          # Starts client (5174) + server (3048) concurrently
```

Dev server binds to `192.168.0.51:5174`. Server proxies at `localhost:3048`.

Set `DEV_AUTH_BYPASS=true` in `.env` to skip auth during local development.

## Key Commands

```bash
npm run dev          # Dev server (client + server)
npm run build        # Build all workspaces
npm test             # Vitest
npm run typecheck    # tsc --noEmit across all workspaces
npm run lint         # ESLint
npm run format       # Prettier
```

## Database

All app data in `quote_calculator` Postgres schema (never `public`).

Core tables: `rate_cards`, `rate_card_items`, `quotes`, `quote_versions`, `version_shots`, `film_templates`, `film_template_shots`.

TowerWatch access checks use `public.effective_user_app_access_view`.

## Auth

Server-side httpOnly cookie auth (`tb_access_token` on `.the-boundary.app`). No client-side Supabase client. Client calls `/api/auth/session` with `credentials: 'include'`.

## API Routes

All protected routes require auth. Admin-only routes check `appAccess.is_admin`.

- `/api/auth/*` — Google OAuth PKCE, session, logout
- `/api/quotes/*` — Quote CRUD + versions + shots
- `/api/rate-cards/*` — Rate card + item CRUD (admin for writes)
- `/api/templates/*` — Film template CRUD (admin for writes)
- `/api/health` — Health check

## Deploy

Container: `quote-calculator`, Port: `3048`, URL: `quotes.the-boundary.app`

Push to `main` triggers GitHub Actions -> GHCR -> Watchtower auto-pulls.
