#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push || echo "DB push skipped (database unavailable in this environment)"
