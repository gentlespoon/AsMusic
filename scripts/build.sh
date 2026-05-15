#!/usr/bin/env bash
# Release build entry point.
#
# Usage:
#   ./scripts/build.sh --version 2.0.0 --build 42 --platform all
#
# Options:
#   --version   Marketing version (e.g. 2.0.0). Defaults to version.json.
#   --build     Build number (integer string). Defaults to version.json.
#   --platform  all | ios | android | web | electron  (default: all)
#
# Stamps version.json and platform files, then runs the platform build(s).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=""
BUILD=""
PLATFORM="all"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

read_version_json_field() {
  local field="$1"
  node -e "
    const v = require('$ROOT/version.json');
    const val = v['$field'];
    if (val == null || val === '') process.exit(1);
    process.stdout.write(String(val));
  "
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:?--version requires a value}"
      shift 2
      ;;
    --build)
      BUILD="${2:?--build requires a value}"
      shift 2
      ;;
    --platform)
      PLATFORM="${2:?--platform requires a value}"
      shift 2
      ;;
    -h | --help) usage 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage 1
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  VERSION="$(read_version_json_field version)" || {
    echo "Missing --version and no version in version.json" >&2
    exit 1
  }
fi
if [[ -z "$BUILD" ]]; then
  BUILD="$(read_version_json_field build)" || {
    echo "Missing --build and no build in version.json" >&2
    exit 1
  }
fi

case "$PLATFORM" in
  all | ios | android | web | electron) ;;
  *)
    echo "Unknown platform: $PLATFORM" >&2
    usage 1
    ;;
esac

"$ROOT/scripts/set-app-version.sh" "$VERSION" "$BUILD" "$PLATFORM"

export VITE_APP_VERSION="$VERSION"
export VITE_APP_BUILD="$BUILD"

build_web() {
  echo "==> web"
  (cd "$ROOT" && pnpm run build)
}

build_ios() {
  echo "==> ios"
  (cd "$ROOT" && pnpm run cap:sync)
  if command -v xcodebuild >/dev/null 2>&1; then
    xcodebuild clean build \
      -project "$ROOT/ios/App/App.xcodeproj" \
      -scheme AsMusic \
      -sdk iphoneos \
      -destination 'generic/platform=iOS' \
      ONLY_ACTIVE_ARCH=YES
  else
    echo "xcodebuild not found; skipped native compile (cap:sync completed)" >&2
  fi
}

build_android() {
  echo "==> android (not implemented)"
  echo "Version stamped to android/version.properties. Add Gradle wiring when the Android app ships." >&2
  exit 1
}

build_electron() {
  echo "==> electron (not implemented)"
  echo "Version stamped to electron/version.json. Add Electron packaging when that target ships." >&2
  exit 1
}

run_platform() {
  case "$1" in
    web) build_web ;;
    ios) build_ios ;;
    android) build_android ;;
    electron) build_electron ;;
  esac
}

if [[ "$PLATFORM" == "all" ]]; then
  build_web
  build_ios
  # android/electron: stamp only (via set-app-version), no compile yet
else
  run_platform "$PLATFORM"
fi

echo "Done: $VERSION ($BUILD) platform=$PLATFORM"
