#!/usr/bin/env bash
# One-step setup for DesignGrill on macOS and Linux (Linux is best effort).
# Checks the tools the desktop app needs, installs what is missing after asking, then installs
# the npm dependencies and verifies that Cargo can read the project.
#
#   bash scripts/setup.sh            check, install what is missing, install dependencies
#   bash scripts/setup.sh --check    only report what is missing; change nothing
#   bash scripts/setup.sh --yes      do not ask before installing
set -euo pipefail

CHECK_ONLY=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
Usage: bash scripts/setup.sh [--check] [--yes]

  --check   Only report what is missing; install nothing.
  --yes     Install missing tools without asking first.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --yes | -y) ASSUME_YES=1 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIN_NODE_20="20.19"
MIN_NODE_22="22.12"
MIN_RUST="1.90"
NVM_VERSION="v0.40.8"
PROBLEMS=0
INSTALLED=0
CARGO_PATH_HINT=
ORIG_PATH="$PATH"

say() { printf '\n== %s\n' "$1"; }
ok() { printf '  [ok]      %s\n' "$1"; }
warn() { printf '  [warn]    %s\n' "$1"; }
missing() { printf '  [missing] %s\n' "$1"; }
fail() { printf '  [failed]  %s\n' "$1" >&2; PROBLEMS=$((PROBLEMS + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }

# True when $1 >= $2 for dotted versions such as 1.90.0 and 1.90 (plain bash; no GNU sort needed).
ver_ge() {
  local IFS=.
  local -a a=($1) b=($2)
  local i x y
  for i in 0 1 2; do
    x=${a[i]:-0}
    y=${b[i]:-0}
    if ((x > y)); then return 0; fi
    if ((x < y)); then return 1; fi
  done
  return 0
}

confirm() {
  if [ "$CHECK_ONLY" = 1 ]; then return 1; fi
  if [ "$ASSUME_YES" = 1 ] || [ ! -t 0 ]; then return 0; fi
  local reply
  read -r -p "  $1 [Y/n] " reply
  case "${reply:-y}" in [Yy]*) return 0 ;; *) return 1 ;; esac
}

add_path() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *)
      if [ -d "$1" ]; then
        PATH="$1:$PATH"
        export PATH
      fi
      ;;
  esac
}

# ---------------------------------------------------------------------------------------------
# System build tools
# ---------------------------------------------------------------------------------------------

pkg_manager() {
  if have apt-get; then echo apt
  elif have dnf; then echo dnf
  elif have pacman; then echo pacman
  else echo none
  fi
}

linux_packages() {
  case "$1" in
    apt) echo "build-essential curl wget file libssl-dev libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev" ;;
    dnf) echo "gcc gcc-c++ make curl wget file openssl-devel webkit2gtk4.1-devel libxdo-devel libappindicator-gtk3-devel librsvg2-devel" ;;
    pacman) echo "gcc make pkgconf curl wget file openssl webkit2gtk-4.1 xdotool libappindicator-gtk3 librsvg" ;;
  esac
}

pkg_installed() {
  case "$1" in
    apt) dpkg -s "$2" >/dev/null 2>&1 ;;
    dnf) rpm -q "$2" >/dev/null 2>&1 ;;
    pacman) pacman -Qq "$2" >/dev/null 2>&1 ;;
  esac
}

ensure_system_tools() {
  say "System build tools"
  case "$(uname -s)" in
    Darwin)
      if xcode-select -p >/dev/null 2>&1; then
        ok "Xcode Command Line Tools"
      else
        missing "Xcode Command Line Tools (compiler and linker)"
        if confirm "Install them now? macOS opens an installer dialog."; then
          xcode-select --install || true
          warn "Finish the installer dialog, then run this script again."
          exit 1
        fi
        PROBLEMS=$((PROBLEMS + 1))
      fi
      ;;
    Linux)
      local manager pkgs p
      local -a absent=()
      manager="$(pkg_manager)"
      if [ "$manager" = none ]; then
        warn "Unknown Linux distribution. Install the Tauri prerequisites yourself:"
        warn "https://tauri.app/start/prerequisites/#linux"
        return
      fi
      pkgs="$(linux_packages "$manager")"
      for p in $pkgs; do
        pkg_installed "$manager" "$p" || absent+=("$p")
      done
      if [ "${#absent[@]}" -eq 0 ]; then
        ok "System packages ($manager)"
        return
      fi
      missing "System packages: ${absent[*]}"
      if confirm "Install them with sudo ($manager)?"; then
        case "$manager" in
          apt) sudo apt-get update && sudo apt-get install -y "${absent[@]}" ;;
          dnf) sudo dnf install -y "${absent[@]}" ;;
          pacman) sudo pacman -S --needed --noconfirm "${absent[@]}" ;;
        esac
      else
        PROBLEMS=$((PROBLEMS + 1))
      fi
      ;;
    *)
      fail "Unsupported system: $(uname -s). On Windows run scripts/setup.ps1 in PowerShell."
      ;;
  esac
}

# ---------------------------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------------------------

load_nvm() {
  local dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$dir/nvm.sh" ]; then
    export NVM_DIR="$dir"
    # nvm.sh is not written for `set -eu`.
    set +eu
    # shellcheck disable=SC1091
    . "$dir/nvm.sh"
    set -eu
    return 0
  fi
  return 1
}

node_ok() {
  have node && have npm || return 1
  local v major
  v="$(node -v | sed 's/^v//')"
  major="${v%%.*}"
  case "$major" in
    20) ver_ge "$v" "$MIN_NODE_20" ;;
    '' | *[!0-9]*) return 1 ;;
    *) [ "$major" -ge 22 ] && ver_ge "$v" "$MIN_NODE_22" ;;
  esac
}

ensure_node() {
  say "Node.js (needs 20.19+ or 22.12+)"
  # A Node installed through nvm is only on PATH once nvm is loaded, which scripts do not do.
  load_nvm || true
  if node_ok; then
    ok "Node $(node -v), npm $(npm -v)"
    return
  fi
  if have node; then
    warn "Node $(node -v) is too old"
  else
    missing "Node.js"
  fi
  if confirm "Install Node.js 22 with nvm (no admin rights needed)?"; then
    if ! load_nvm; then
      have curl || { fail "curl is required to install nvm"; return; }
      curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
      load_nvm || { fail "nvm was installed but could not be loaded"; return; }
    fi
    set +eu
    nvm install 22 && nvm alias default 22 >/dev/null && nvm use 22 >/dev/null
    set -eu
    INSTALLED=1
  fi
  if node_ok; then
    ok "Node $(node -v), npm $(npm -v)"
  else
    if [ "$CHECK_ONLY" = 1 ]; then
      PROBLEMS=$((PROBLEMS + 1))
    else
      fail "Node.js 20.19+ or 22.12+ is still not available"
    fi
  fi
}

# ---------------------------------------------------------------------------------------------
# Rust
# ---------------------------------------------------------------------------------------------

load_rust_path() {
  add_path "$HOME/.cargo/bin"
  # Homebrew's rustup is keg-only: its cargo is not on PATH unless added by hand.
  add_path /opt/homebrew/opt/rustup/bin
  add_path /usr/local/opt/rustup/bin
}

rust_version() {
  rustc --version 2>/dev/null | awk '{print $2}' || true
}

rust_ok() {
  have cargo || return 1
  local v
  v="$(rust_version)"
  [ -n "$v" ] && ver_ge "$v" "$MIN_RUST"
}

# Remembers where cargo lives when a normal new terminal would not find it.
note_cargo_path() {
  if ! PATH="$ORIG_PATH" command -v cargo >/dev/null 2>&1; then
    CARGO_PATH_HINT="$(dirname "$(command -v cargo)")"
  fi
}

ensure_rust() {
  say "Rust (needs $MIN_RUST or newer; provides cargo)"
  load_rust_path
  if rust_ok; then
    ok "Rust $(rust_version) with cargo"
    note_cargo_path
    return
  fi

  if have cargo && [ -n "$(rust_version)" ]; then
    warn "Rust $(rust_version) is older than $MIN_RUST"
  else
    missing "Rust toolchain (cargo not found or no toolchain installed)"
  fi

  if confirm "Install or update Rust with rustup?"; then
    if have rustup; then
      rustup toolchain install stable --profile minimal
      rustup default stable
    else
      have curl || { fail "curl is required to install rustup"; return; }
      curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal
      INSTALLED=1
    fi
    load_rust_path
  fi

  if rust_ok; then
    ok "Rust $(rust_version) with cargo"
    note_cargo_path
  else
    if [ "$CHECK_ONLY" = 1 ]; then
      PROBLEMS=$((PROBLEMS + 1))
    else
      fail "Rust $MIN_RUST or newer is still not available"
    fi
  fi
}

# ---------------------------------------------------------------------------------------------
# Project dependencies and final check
# ---------------------------------------------------------------------------------------------

ensure_dependencies() {
  say "Project dependencies"
  if [ "$CHECK_ONLY" = 1 ]; then
    if [ -d "$REPO_ROOT/node_modules" ]; then ok "node_modules present"; else missing "node_modules (run npm install)"; PROBLEMS=$((PROBLEMS + 1)); fi
    return
  fi
  if ! node_ok; then
    fail "Skipped npm install because Node.js is not ready"
    return
  fi
  (cd "$REPO_ROOT" && npm install) && ok "npm packages installed" || fail "npm install failed"
}

verify_cargo_project() {
  say "Checking that Cargo can read the project"
  if ! rust_ok; then
    if [ "$CHECK_ONLY" = 1 ]; then warn "Skipped: Rust is not ready"; else fail "Skipped: Rust is not ready"; fi
    return
  fi
  # This is the call that `tauri dev` makes first; it fails with "No such file or directory"
  # when cargo is not on PATH.
  if cargo metadata --no-deps --format-version 1 --manifest-path "$REPO_ROOT/src-tauri/Cargo.toml" >/dev/null 2>&1; then
    ok "cargo metadata works"
  else
    fail "cargo could not read src-tauri/Cargo.toml"
  fi
}

printf 'DesignGrill setup (%s)\n' "$([ "$CHECK_ONLY" = 1 ] && echo "check only" || echo "check and install")"

ensure_system_tools
ensure_node
ensure_rust
ensure_dependencies
verify_cargo_project

echo
if [ "$PROBLEMS" -gt 0 ]; then
  if [ "$CHECK_ONLY" = 1 ]; then
    echo "$PROBLEMS item(s) need attention. Run without --check to install what is missing."
  else
    echo "Setup finished with $PROBLEMS problem(s). Fix the items marked [failed] above and run it again."
  fi
  exit 1
fi

echo "All set."
if [ "$INSTALLED" = 1 ]; then
  echo "Tools were just installed. Open a NEW terminal window before the next step so they are on your PATH."
fi
if [ -n "$CARGO_PATH_HINT" ] && [ "$INSTALLED" = 0 ]; then
  echo
  echo "Note: cargo is installed in $CARGO_PATH_HINT, but a normal terminal does not have that folder on its PATH."
  echo "That is what causes 'failed to run cargo metadata ... No such file or directory'."
  echo "Add this line to ~/.zshrc (or ~/.bashrc) and open a new terminal:"
  echo "  export PATH=\"$CARGO_PATH_HINT:\$PATH\""
fi
echo
echo "Start the desktop app with:  npm run dev:desktop"
echo "The first launch compiles the Rust side and can take several minutes."
