# Engineering standards pack (Cursor + Replit)

Reusable **Cursor rules** and an **`AGENTS.md` template** for any application in this ecosystem.  
**ABA Note Assistant** keeps its own authoritative `.cursor/rules/` (including ABA-specific clinical rules); this folder does **not** replace those files.

## What this is for

- **New repositories:** copy rules + fill the template.
- **Existing repositories (non-ABA):** run the install script so every app gets the same baseline.
- **This repo (ABANOTEASSISTANT):** optional reference only — your binding rules remain `.cursor/rules/aba-note-*.mdc`, `collaboration.mdc`, etc.

## Contents

| Path | Purpose |
|------|---------|
| `cursor-rules/` | Generic `.mdc` files (`org-*`) — Cursor + Replit boundaries, API, DB, backend |
| `AGENTS.template.md` | Starter `AGENTS.md` with `{{PLACEHOLDERS}}` |
| `NEW_APP_CHECKLIST.md` | Step-by-step adoption |
| `scripts/install-into-repo.sh` | Copy rules into another repo safely |

## Quick start (another app repository)

From the **ABA Note Assistant** repo root:

```bash
./engineering-standards/scripts/install-into-repo.sh /absolute/path/to/other-app
```

Then:

1. Copy `engineering-standards/AGENTS.template.md` to that app’s root as `AGENTS.md` and replace every `{{...}}` placeholder (or merge sections into an existing `AGENTS.md`).
2. Commit `.cursor/rules/org-*.mdc` and `AGENTS.md` in that app.
3. On **Replit**, open the same repo — Replit reads **`AGENTS.md`**; it does not read `.cursor/rules`.

## Naming

Template rules use the **`org-`** prefix so they do not clash with project-specific files like `collaboration.mdc`. You may rename after install if you prefer a single canonical name per repo.

## Updating standards

Edit files under `engineering-standards/`, commit, then re-run `install-into-repo.sh` on other apps (or manually diff/merge) to propagate changes.
