# Contributing & handoff (Cursor + Replit)

This monorepo is edited in **Cursor** (backend/API) and **Replit** (UI). Both pull from **`main`**. These rules keep `main` buildable and avoid silent breakage.

**Other repositories in your ecosystem:** Reusable Cursor + Replit alignment templates (generic `org-*.mdc` rules, `AGENTS.md` starter, install script) live in **`engineering-standards/`**. They do not replace this repo’s `.cursor/rules/`; use them when bootstrapping or updating *other* apps. See **`engineering-standards/README.md`**.

## Source of truth

- **Git branch `main`** should stay deployable: install, typecheck, and build are expected to pass after merge.
- **HTTP API contract** = `lib/api-spec/openapi.yaml`. Do not change request/response shapes in server code without updating the spec.

## Ownership

| Area | Primary owner | Paths (typical) |
|------|----------------|------------------|
| Backend, DB, auth, APIs | Cursor | `artifacts/api-server/`, `lib/db/` |
| API contract & codegen | Cursor (coordinate frontend if the contract changes) | `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` (generated) |
| Web app look & UX | Replit | `artifacts/abanoteassistant/` (components, pages, styles) |

**Generated code:** Do not hand-edit `lib/api-client-react/src/generated/*` or `lib/api-zod/src/generated/*`. Regenerate with codegen (see below).

## When the API changes

1. Edit **`lib/api-spec/openapi.yaml`**.
2. From repo root: **`pnpm run codegen`**.
3. Update **`artifacts/api-server`** (routes, validation using `@workspace/api-zod`).
4. Update **`artifacts/abanoteassistant`** if response shapes or endpoints changed (use generated hooks).
5. Run **`pnpm run typecheck`** and **`pnpm run build`** before merging to `main`.

## Frontend ↔ API

- Prefer **`@workspace/api-client-react`** generated hooks for `/api/*` calls.
- Avoid ad-hoc `fetch("/api/...")` with guessed shapes unless documented; it bypasses the typed contract.

## Environment & build (Replit + local)

- The SPA build reads **`PORT`** and **`BASE_PATH`** for Vite (see `artifacts/abanoteassistant/vite.config.ts`). Set these in Replit / CI / local env as required.
- New server or client env vars should be documented in **`artifacts/api-server/.env.example`** (and Replit secrets where applicable).

## Pull / merge checklist (both sides)

Before pushing to **`main`**:

- [ ] `pnpm install` (especially if `pnpm-lock.yaml` changed)
- [ ] If OpenAPI changed: `pnpm run codegen`
- [ ] `pnpm run typecheck`
- [ ] `pnpm run build` (root script runs workspace builds)

## Lockfile conflicts

- If **`pnpm-lock.yaml`** conflicts, resolve by running **`pnpm install`** on one machine and committing the result—do not hand-merge lockfiles.

## Cursor-specific guidance

- See **`.cursor/rules/`** for focused rules (API spec, database, collaboration).
- **`AGENTS.md`** describes historical project roles; this file is the **handoff** contract for Cursor + Replit.

## Replit

- Treat **`CONTRIBUTING.md`** as the shared process doc when pulling **`main`** and before merging UI work back.
