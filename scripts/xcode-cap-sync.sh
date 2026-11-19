#!/usr/bin/env bash
# Xcode Run Script phase: build the web app and sync it into ios/.
# SRCROOT is ios/App when invoked from App.xcodeproj.
set -euo pipefail

if [[ -n "${SRCROOT:-}" ]]; then
  ROOT="$(cd "${SRCROOT}/../.." && pwd)"
else
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

# Xcode GUI launches with a minimal PATH; load common Node/pnpm locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/share/pnpm:${PATH:-}"
export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
fi

cd "$ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm not found on PATH. Install Node via nvm/Homebrew, then reopen Xcode." >&2
  exit 1
fi

echo "note: pnpm cap:sync (repo root: ${ROOT})"
pnpm cap:sync
