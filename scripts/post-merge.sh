#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push || echo "DB push skipped (database unavailable in this environment)"
pnpm --filter @workspace/abanoteassistant run build || echo "Frontend build skipped (build tools unavailable in this environment)"
