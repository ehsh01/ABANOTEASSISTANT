# New app checklist (Cursor + Replit alignment)

Use this when creating or onboarding a repository that uses **Cursor** for backend/API and **Replit** (or another team) for frontend.

## 1. Repository layout

- [ ] Document in `AGENTS.md`: paths to API server, web app, OpenAPI spec (if any), DB package, codegen command.

## 2. Cursor rules

- [ ] Run `engineering-standards/scripts/install-into-repo.sh /path/to/your/repo` from the ABA Note Assistant monorepo (or copy `engineering-standards/cursor-rules/*.mdc` manually into `your-repo/.cursor/rules/`).
- [ ] If paths in the generic rules do not match your layout, add one app-specific `.mdc` that states the correct paths (or extend `AGENTS.md`).

## 3. Human / Replit visibility

- [ ] Add or merge **`AGENTS.md`** at the repo root (start from `AGENTS.template.md`).
- [ ] Add a one-line pointer in **README.md**: “Contributors: read `AGENTS.md`.”

## 4. API contract (if applicable)

- [ ] Choose a single source of truth for HTTP (e.g. `openapi.yaml`).
- [ ] Document: spec change → codegen → implement route → typecheck/build.
- [ ] Forbid hand-editing generated client/schema directories.

## 5. Optional: product-specific rules

- [ ] Add `.cursor/rules/*.mdc` files that are **only** for that product (compliance, domain language, etc.), with `alwaysApply` as needed.

## 6. Verify

- [ ] Open the repo in Cursor — rules should load from `.cursor/rules/`.
- [ ] Replit: confirm `AGENTS.md` is visible in the file tree.
