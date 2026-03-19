# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── abanoteassistant/   # ABA Note Assistant React frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Applications

### ABA Note Assistant (`artifacts/abanoteassistant`)

A React + Vite web app for ABA (Applied Behavior Analysis) therapists to auto-generate session notes.

**Pages / Routes:**
- `/` — Home page with "Create Note with AI" CTA
- `/wizard` — 8-step multi-step note generation wizard
- `/result` — Generated note result screen with edit/save/copy actions

**Wizard Steps:**
1. Select Client (with assessment status checks)
2. Session Length (1-8 hours)
3. Session Date (date picker)
4. Who Was Present (multi-select + custom tags)
5. Environmental Changes (toggle + textarea)
6. Replacement Programs (multi-select, primary vs supplemental)
7. Next Session Date (optional)
8. Review & Generate

**Key Features:**
- Full-screen loading overlay during generation (with 4-minute timeout support)
- Inline editing of generated note
- Copy to clipboard, Save Draft, Save Final actions
- Warnings banner for API warnings
- Error states: generic, structured, 409 conflict, network
- Mobile-responsive with sticky footer navigation
- Zustand state management for wizard flow
- Mock API calls via `use-aba-api.ts` hooks (ready to wire to real backend)

**API Fields collected (for backend):**
- `clientId`, `sessionHours`, `sessionDate`, `presentPeople[]`
- `hasEnvironmentalChanges`, `environmentalChanges`
- `selectedReplacements[]`, `nextSessionDate`

**State management:** `src/store/wizard-store.ts` (Zustand)
**API hooks:** `src/hooks/use-aba-api.ts` (mock, ready for real API wiring)
**Frontend packages:** zustand, framer-motion, lucide-react, date-fns, clsx, tailwind-merge

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `health.ts` — `GET /api/healthz`
  - `clients.ts` — `GET /api/clients`, `GET /api/clients/:id`, `GET /api/clients/:id/programs`
  - `notes.ts` — `POST /api/notes/generate`, `POST /api/notes/:id/save`
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## API Contract (OpenAPI)

All endpoints follow the pattern: `{ success: boolean, data: ..., error: string | null }`

Key endpoints:
- `GET /api/clients` — list all clients
- `GET /api/clients/:id` — client detail
- `GET /api/clients/:id/programs` — replacement programs for a client
- `POST /api/notes/generate` — generate a session note (accepts `GenerateNoteRequest`)
- `POST /api/notes/:id/save` — save a note as draft or final
