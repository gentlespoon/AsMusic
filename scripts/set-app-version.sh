#!/usr/bin/env bash
# Stamp version/build into platform-specific files and version.json.
# Usage: set-app-version.sh <version> <build> [platform]
#   platform: all | ios | android | web | electron  (default: all)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?version required}"
BUILD="${2:?build required}"
PLATFORM="${3:-all}"

VERSION_JSON="$ROOT/version.json"
IOS_XCCONFIG="$ROOT/ios/Version.xcconfig"
ANDROID_PROPS="$ROOT/android/version.properties"
WEB_APP_INFO="$ROOT/apps/web/public/app-info.json"
ELECTRON_VERSION_JSON="$ROOT/electron/version.json"

write_version_json() {
  cat >"$VERSION_JSON" <<EOF
{
  "version": "$VERSION",
  "build": "$BUILD"
}
EOF
}

stamp_ios() {
  cat >"$IOS_XCCONFIG" <<EOF
// App marketing version and build number. Updated by scripts/set-app-version.sh.
MARKETING_VERSION = $VERSION
CURRENT_PROJECT_VERSION = $BUILD
EOF
}

stamp_android() {
  mkdir -p "$(dirname "$ANDROID_PROPS")"
  cat >"$ANDROID_PROPS" <<EOF
# Updated by scripts/set-app-version.sh — wire into build.gradle when Android ships.
VERSION_NAME=$VERSION
VERSION_CODE=$BUILD
EOF
}

stamp_web() {
  mkdir -p "$(dirname "$WEB_APP_INFO")"
  cat >"$WEB_APP_INFO" <<EOF
{"version":"$VERSION","build":"$BUILD"}
EOF
}

stamp_electron() {
  mkdir -p "$(dirname "$ELECTRON_VERSION_JSON")"
  cat >"$ELECTRON_VERSION_JSON" <<EOF
{
  "version": "$VERSION",
  "build": "$BUILD"
}
EOF
}

write_version_json

case "$PLATFORM" in
  all)
    stamp_ios
    stamp_android
    stamp_web
    stamp_electron
    ;;
  ios) stamp_ios ;;
  android) stamp_android ;;
  web) stamp_web ;;
  electron) stamp_electron ;;
  *)
    echo "Unknown platform: $PLATFORM (expected all|ios|android|web|electron)" >&2
    exit 1
    ;;
esac

echo "Set version $VERSION ($BUILD) for platform: $PLATFORM"
