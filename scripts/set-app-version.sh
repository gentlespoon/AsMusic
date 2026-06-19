#!/usr/bin/env bash
# Stamp version/build into platform-specific files and version.json.
#
# Usage:
#   set-app-version.sh <version> <build> [platform]
#   set-app-version.sh
#
# With arguments, sets the given version and build directly.
# Without arguments, shows the current version and prompts interactively.
#
#   platform: all | ios | android | web | electron  (default: all)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_JSON="$ROOT/version.json"
IOS_XCCONFIG="$ROOT/ios/Version.xcconfig"
ANDROID_PROPS="$ROOT/android/version.properties"
WEB_APP_INFO="$ROOT/apps/web/public/app-info.json"
ELECTRON_VERSION_JSON="$ROOT/electron/version.json"

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

read_version_json_field() {
  local field="$1"
  node -e "
    const v = require('$VERSION_JSON');
    const val = v['$field'];
    if (val == null || val === '') process.exit(1);
    process.stdout.write(String(val));
  "
}

bump_version() {
  local version="$1"
  local bump_type="$2"
  local major minor patch

  IFS='.' read -r major minor patch <<<"$version"
  patch="${patch%%[^0-9]*}"

  case "$bump_type" in
    fix) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
    *)
      echo "Unknown bump type: $bump_type" >&2
      exit 1
      ;;
  esac

  echo "${major}.${minor}.${patch}"
}

# Arrow-key menu. Args: prompt label value [label value ...]
# Prints the selected value to stdout; UI is drawn on stderr.
select_option() {
  local prompt="$1"
  shift

  local -a labels=()
  local -a values=()
  while [[ $# -ge 2 ]]; do
    labels+=("$1")
    values+=("$2")
    shift 2
  done

  local count=${#labels[@]}
  local selected=0
  local key redraw_lines=$((count + 2))

  render_menu() {
    local i
    echo "$prompt" >&2
    for ((i = 0; i < count; i++)); do
      if [[ $i -eq $selected ]]; then
        printf '   \033[7m%s\033[0m\n' "${labels[$i]}" >&2
      else
        printf '   %s\n' "${labels[$i]}" >&2
      fi
    done
    printf '  \033[2m↑/↓ select · Enter confirm\033[0m\n' >&2
  }

  printf '\033[?25l' >&2
  trap 'printf "\033[?25h" >&2' RETURN

  render_menu
  while true; do
    IFS= read -rsn1 key || break
    case "$key" in
      $'\x1b')
        read -rsn1 key
        if [[ "$key" == '[' ]]; then
          read -rsn1 key
          case "$key" in
            A) selected=$(( (selected - 1 + count) % count )) ;;
            B) selected=$(( (selected + 1) % count )) ;;
            *) continue ;;
          esac
        elif [[ "$key" == 'O' ]]; then
          read -rsn1 key
          case "$key" in
            A) selected=$(( (selected - 1 + count) % count )) ;;
            B) selected=$(( (selected + 1) % count )) ;;
            *) continue ;;
          esac
        else
          continue
        fi
        ;;
      '' | $'\n' | $'\r') break ;;
      *) continue ;;
    esac
    printf '\033[%dA' "$redraw_lines" >&2
    render_menu
  done

  printf '\033[?25h' >&2
  trap - RETURN
  echo "${values[$selected]}"
}

prompt_version() {
  local current_version="$1"
  local fix_version minor_version major_version

  fix_version="$(bump_version "$current_version" fix)"
  minor_version="$(bump_version "$current_version" minor)"
  major_version="$(bump_version "$current_version" major)"

  VERSION="$(select_option "Which version to use?" \
    "$fix_version (fix)" "$fix_version" \
    "$minor_version (minor)" "$minor_version" \
    "$major_version (major)" "$major_version")"
}

prompt_build() {
  local current_build="$1"
  local incremental_build="$((current_build + 1))"

  echo >&2
  BUILD="$(select_option "Which build number to use?" \
    "$incremental_build (incremental)" "$incremental_build" \
    "1 (reset)" "1")"
}

interactive_mode() {
  local current_version current_build

  if [[ ! -t 0 || ! -t 1 ]]; then
    echo "Interactive mode requires a TTY. Pass version and build as arguments." >&2
    usage 1
  fi

  current_version="$(read_version_json_field version)" || {
    echo "Could not read version from version.json" >&2
    exit 1
  }
  current_build="$(read_version_json_field build)" || {
    echo "Could not read build from version.json" >&2
    exit 1
  }

  echo "Current version: $current_version ($current_build)"
  echo
  prompt_version "$current_version"
  prompt_build "$current_build"
}

if [[ $# -ge 2 ]]; then
  VERSION="$1"
  BUILD="$2"
  PLATFORM="${3:-all}"
elif [[ $# -eq 0 ]]; then
  PLATFORM="all"
  interactive_mode
else
  echo "Expected <version> <build> [platform], or no arguments for interactive mode." >&2
  usage 1
fi

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
