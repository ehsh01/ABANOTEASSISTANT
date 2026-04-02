#!/usr/bin/env bash
# Copy organization Cursor rules into another repository.
# Does NOT modify ABA Note Assistant's existing .cursor/rules (run with a different TARGET).
#
# Usage:
#   ./engineering-standards/scripts/install-into-repo.sh /path/to/other-repo
#   ./engineering-standards/scripts/install-into-repo.sh /path/to/other-repo --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RULES_SRC="$PACK_ROOT/cursor-rules"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/or/relative/path/to/target-repo [--dry-run]" >&2
  exit 1
fi

TARGET="$(cd "$1" 2>/dev/null && pwd || true)"
if [[ -z "${TARGET:-}" ]] || [[ ! -d "$TARGET" ]]; then
  echo "Error: not a directory: $1" >&2
  exit 1
fi

DRY=false
if [[ "${2:-}" == "--dry-run" ]]; then
  DRY=true
fi

DEST="$TARGET/.cursor/rules"
FILES=("$RULES_SRC"/*.mdc)
if [[ ! -e "${FILES[0]}" ]]; then
  echo "Error: no .mdc files in $RULES_SRC" >&2
  exit 1
fi

if $DRY; then
  echo "Would mkdir -p $DEST"
  for f in "${FILES[@]}"; do
    echo "Would cp $(basename "$f") -> $DEST/"
  done
  exit 0
fi

mkdir -p "$DEST"
for f in "${FILES[@]}"; do
  cp "$f" "$DEST/"
  echo "Installed $(basename "$f")"
done

echo ""
echo "Done. Next steps:"
echo "  1. Add or merge AGENTS.md from engineering-standards/AGENTS.template.md (replace {{...}} placeholders)."
echo "  2. Commit $DEST and AGENTS.md in the target repo."
echo "  3. Replit: same repo — contributors read AGENTS.md; Cursor loads .cursor/rules."
