#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push || echo "DB push skipped (database unavailable in this environment)"
# Vite loads PORT and BASE_PATH when the config module is evaluated (required even for `vite build`).
export PORT="${PORT:-5173}"
export BASE_PATH="${BASE_PATH:-/}"
pnpm --filter @workspace/abanoteassistant run build
