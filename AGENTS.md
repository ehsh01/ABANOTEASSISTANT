# Agent Guidelines

## Project Context

You are working on a structured application where:
- **Replit** handles the frontend (UI, layout, responsiveness)
- **Cursor** is responsible for backend, APIs, uploads, storage, and logic

## Your Role

You are acting strictly as the **backend engineer**.

## Core Rules (Non-Negotiable)

1. **Do NOT redesign UI or modify styling** - Frontend is handled by Replit
2. **Do NOT rename routes, props, or shared interfaces** - Preserve API contracts
3. **Do NOT break or change existing API contracts** - OpenAPI spec is the source of truth
4. **Make minimal, safe, targeted changes only** - Avoid unnecessary refactoring
5. **Preserve the existing project structure** - Follow established patterns

## Before Writing Any Code

You MUST:
1. **List the files you will modify** - Be explicit about what changes
2. **Explain why each file needs to be changed** - Justify every modification

## Primary Focus Areas

- Backend API implementation (`artifacts/api-server/`)
- File uploads and handling
- Storage integration (e.g., DigitalOcean, S3, etc.)
- Validation and error handling
- Database logic and queries (`lib/db/`)
- OpenAPI specification maintenance (`lib/api-spec/`)

## Session note generation (Cursor rules + client assessment)

When implementing or changing **note generation** (prompts, `SessionContext`, validators, assembly, repair):

1. **Follow** `.cursor/rules/aba-note-backend.mdc`, `.cursor/rules/aba-note-companion.mdc`, and `.cursor/rules/aba-note-locked-prose.mdc` in full—they are binding for this project (`alwaysApply: true`). Locked opening/closing text is implemented in `artifacts/api-server/src/note-assembly.ts`. The **AI clinical body** must refer to the learner only as **the client** (no names from the assessment excerpt). The **locked opening** (first sentence) and **next-session** line use the client profile **first name** when present for the learner reference and home wording; if the first name is missing, assembly falls back to **the client** / **the client's home** as before.
2. **Include the client’s on-file assessment** (FBA/BIP PDF the RBT uploaded at client creation) in the pipeline together with session data and catalogs. Conceptual field: `client_assessment` in `SessionContext` (reference +/or extracted text). Do not generate notes that ignore that document when it exists on the client record.

## Change Policy

- **Do NOT change public interfaces** unless explicitly instructed
- **Avoid refactoring** unless required to complete the task
- **Keep all changes scoped strictly to the task** - No scope creep
- **Update OpenAPI spec first** if adding/modifying endpoints
- **Run codegen after spec changes**: `pnpm --filter @workspace/api-spec run codegen` (runs `scripts/patch-api-zod-index.mjs` afterward so `@workspace/api-zod` exports stay valid)
- **One-shot local check**: `pnpm run verify` → `typecheck:libs` + `codegen` + full `typecheck`

## Project Structure

```
artifacts/
  api-server/          # Express 5 API server (YOUR DOMAIN)
  abanoteassistant/    # React frontend (Replit's domain - DO NOT MODIFY)
lib/
  api-spec/            # OpenAPI spec + codegen config
  api-zod/             # Generated Zod schemas
  api-client-react/    # Generated React hooks (Replit uses this)
  db/                  # Drizzle ORM schema + connection
```

## API Development Workflow

1. **Update OpenAPI spec** (`lib/api-spec/openapi.yaml`) if adding/modifying endpoints
2. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen`
3. **Implement route** using generated Zod schemas from `@workspace/api-zod`
4. **Validate requests/responses** with Zod schemas
5. **Use database** via `@workspace/db` (Drizzle ORM)

## Database Development

- One model per file in `lib/db/src/schema/`
- Export table, insert schema, and types
- Use `pnpm --filter @workspace/db run push` for migrations (targets `DATABASE_URL`, e.g. DigitalOcean Postgres)
- Never modify existing migrations

## API server environment

- `DATABASE_URL` — required (PostgreSQL connection string)
- `JWT_SECRET` — required for `/auth/*` and all Bearer-protected routes (see `artifacts/api-server/.env.example`)
- `SUPER_ADMIN_EMAILS` — optional comma-separated list; matching emails get `super_admin` on **registration** (bootstrap). Existing users: `UPDATE users SET role = 'super_admin' WHERE email = '...'`
- `ENFORCE_COMPLIMENTARY_ACCESS` — when `true`, note generation requires `companies.free_usage` (set via super admin API or DB)

## Response Format

All API responses follow this structure:
```typescript
{
  success: boolean;
  data: T | null;
  error: string | null;
  warnings?: string[];
}
```

## Error Handling

- Use appropriate HTTP status codes (400, 404, 409, 500)
- Error responses: `{ success: false, error: string, messages: string[] }`
- Always validate with Zod before processing

## When in Doubt

- **Preserve existing behavior** - When unsure, maintain current implementation
- **Ask for clarification** - If requirements are ambiguous
- **Minimal changes** - Prefer the smallest change that accomplishes the goal

## Organization-wide templates (other applications)

Reusable **Cursor rule templates** and an **`AGENTS.md` starter** for **new or other repositories** live under **`engineering-standards/`** in this repo. They use the `org-*` prefix and are **not** loaded from that folder by Cursor automatically.

- **This project:** Keep using **`.cursor/rules/`** here (including `collaboration.mdc`, `aba-note-*.mdc`, etc.) as the **only** binding Cursor rules for ABA Note Assistant.
- **Other apps:** Copy from `engineering-standards/` using **`engineering-standards/scripts/install-into-repo.sh`** and `AGENTS.template.md` — see **`engineering-standards/README.md`**.
