# Agent Guidelines — {{APP_DISPLAY_NAME}}

## Project context

- **Frontend (UI, layout, styling):** typically owned by **Replit** or a dedicated frontend workflow — do not redesign unless explicitly requested.
- **Backend (APIs, auth, DB, validation, infra):** typically owned by **Cursor** / backend engineers.

Adjust the above if your team splits ownership differently; document the truth here.

## Your role

You are acting as: **{{AGENT_ROLE}}** (e.g. backend engineer, full-stack with UI freeze, etc.).

## Core rules (non-negotiable)

1. **Do not break API contracts** — If you use OpenAPI (or similar), the spec is the source of truth; update it before changing shapes.
2. **Do not hand-edit generated code** — Regenerate via the project’s codegen command (see below).
3. **Do not rename public routes, env contracts, or shared types** without an explicit migration plan.
4. **Minimal, targeted changes** — No drive-by refactors.
5. **List files to modify and why** before large edits.

## Project layout (fill in for this repository)

| Area | Path / package |
|------|----------------|
| API server | `{{BACKEND_PATH}}` |
| Web app | `{{FRONTEND_PATH}}` |
| OpenAPI / spec | `{{OPENAPI_PATH}}` |
| Generated Zod / client | `{{GENERATED_PATHS}}` |
| Database / ORM | `{{DB_PATH}}` |

## API workflow (if OpenAPI + codegen)

1. Edit **`{{OPENAPI_PATH}}`**.
2. Run **`{{CODEGEN_COMMAND}}`** from the documented root.
3. Implement or update server handlers using generated validators/types.
4. Update the frontend only if the contract changed; use generated hooks/clients when available.

## Database (if Drizzle or similar)

- One model/table per file (or follow your ORM’s house style).
- Do not rewrite old migrations unless your policy explicitly allows it.
- Document migration commands in this file.

## Environment

List required env vars and point to **`.env.example`** (or equivalent).

## Error / response shape

Document the standard JSON envelope for your API (e.g. `success`, `data`, `error`, `messages` / `warnings`).

## When in doubt

Preserve existing behavior, ask for clarification, prefer the smallest safe change.

---

**Replace every `{{...}}` placeholder before treating this file as final.**
