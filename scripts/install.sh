#!/usr/bin/env bash
# Ordine installer — installs the CLI and optionally provisions a self-host server.
#
# Install / upgrade CLI only:
#   curl -fsSL https://raw.githubusercontent.com/forge-town/ordine/main/scripts/install.sh | bash
#
# Install CLI + provision self-host server:
#   curl -fsSL https://raw.githubusercontent.com/forge-town/ordine/main/scripts/install.sh | bash -s -- --with-server
#
# After installation, run `ordine` to get started.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REPO_URL="https://github.com/forge-town/ordine.git"
REPO_WEB_URL="https://github.com/forge-town/ordine"
INSTALL_DIR="${ORDINE_INSTALL_DIR:-$HOME/.ordine/server}"
NPM_PACKAGE="@ordine/cli"

# Colors (disabled when not a terminal)
if [ -t 1 ] || [ -t 2 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  BOLD='' GREEN='' YELLOW='' RED='' CYAN='' RESET=''
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { printf "${BOLD}${CYAN}==> %s${RESET}\n" "$*"; }
ok()    { printf "${BOLD}${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "${BOLD}${YELLOW}⚠ %s${RESET}\n" "$*" >&2; }
fail()  { printf "${BOLD}${RED}✗ %s${RESET}\n" "$*" >&2; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
  case "$(uname -s)" in
    Darwin) OS="darwin" ;;
    Linux)  OS="linux" ;;
    MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            warn "Windows detected. Consider using PowerShell installer or WSL." ;;
    *)      fail "Unsupported operating system: $(uname -s)" ;;
  esac

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    arm64)   ARCH="arm64" ;;
    *)       fail "Unsupported architecture: $ARCH" ;;
  esac
}

# ---------------------------------------------------------------------------
# Node.js runtime detection
# ---------------------------------------------------------------------------
detect_node_runtime() {
  if command_exists bun; then
    NODE_RUNTIME="bun"
    GLOBAL_INSTALL_CMD="bun install -g"
  elif command_exists pnpm; then
    NODE_RUNTIME="pnpm"
    GLOBAL_INSTALL_CMD="pnpm install -g"
  elif command_exists npm; then
    NODE_RUNTIME="npm"
    GLOBAL_INSTALL_CMD="npm install -g"
  else
    return 1
  fi
  return 0
}

install_bun() {
  info "Installing bun (recommended runtime)..."
  if command_exists curl; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    # Add to shell profiles
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
      if [ -f "$rc" ] && ! grep -qF '.bun/bin' "$rc"; then
        printf '\n# Added by Ordine installer\nexport BUN_INSTALL="$HOME/.bun"\nexport PATH="$BUN_INSTALL/bin:$PATH"\n' >> "$rc"
      fi
    done
    ok "bun installed"
  else
    fail "curl is required to install bun. Please install curl first."
  fi
}

# ---------------------------------------------------------------------------
# CLI Installation
# ---------------------------------------------------------------------------
install_cli() {
  if command_exists ordine; then
    local current_ver
    current_ver=$(ordine --version 2>/dev/null || echo "unknown")
    ok "Ordine CLI is already installed ($current_ver) — upgrading..."
  fi

  if ! detect_node_runtime; then
    info "No Node.js package manager found. Installing bun..."
    install_bun
    if ! detect_node_runtime; then
      fail "Failed to set up a package manager. Please install bun, npm, or pnpm manually."
    fi
  fi

  info "Installing Ordine CLI via $NODE_RUNTIME..."
  if $GLOBAL_INSTALL_CMD "$NPM_PACKAGE"; then
    ok "Ordine CLI installed via $NODE_RUNTIME"
  else
    fail "Failed to install $NPM_PACKAGE. Check your network connection and permissions."
  fi

  # Verify
  if ! command_exists ordine; then
    warn "CLI installed but 'ordine' not found on PATH. You may need to restart your shell."
    warn "Try: exec \$SHELL"
  else
    local ver
    ver=$(ordine --version 2>/dev/null || echo "installed")
    ok "Ordine CLI ready ($ver)"
  fi
}

# ---------------------------------------------------------------------------
# Server setup (self-host / --with-server)
# ---------------------------------------------------------------------------
check_docker() {
  if ! command_exists docker; then
    printf "\n"
    fail "Docker is not installed. Ordine self-hosting requires Docker and Docker Compose.

Install Docker:
  macOS:  https://docs.docker.com/desktop/install/mac-install/
  Linux:  https://docs.docker.com/engine/install/

After installing Docker, re-run this script with --with-server."
  fi

  if ! docker info >/dev/null 2>&1; then
    fail "Docker is installed but not running. Please start Docker and re-run this script."
  fi

  ok "Docker is available"
}

get_latest_version() {
  curl -sI "$REPO_WEB_URL/releases/latest" 2>/dev/null | grep -i '^location:' | sed 's/.*tag\///' | tr -d '\r\n' || true
}

get_selfhost_ref() {
  if [ -n "${ORDINE_SELFHOST_REF:-}" ]; then
    printf '%s' "$ORDINE_SELFHOST_REF"
    return
  fi

  local latest
  latest=$(get_latest_version)
  if [ -n "$latest" ]; then
    printf '%s' "$latest"
    return
  fi

  printf '%s' "main"
}

checkout_ref() {
  local ref="$1"

  if [ "$ref" = "main" ]; then
    git fetch origin main --depth 1 2>/dev/null || true
    git checkout --force main 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || true
    return
  fi

  git fetch origin --tags --force 2>/dev/null || true
  if git rev-parse --verify --quiet "refs/tags/$ref" >/dev/null; then
    git checkout --force "$ref" 2>/dev/null || git checkout --force "tags/$ref" 2>/dev/null || true
    return
  fi

  git fetch origin "$ref" --depth 1 2>/dev/null || true
  git checkout --force "$ref" 2>/dev/null || true
}

setup_server() {
  info "Setting up Ordine server..."
  local server_ref
  server_ref=$(get_selfhost_ref)
  info "Using self-host assets from ${server_ref}..."

  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation at $INSTALL_DIR..."
    cd "$INSTALL_DIR"
  else
    info "Cloning Ordine repository..."
    if ! command_exists git; then
      fail "Git is not installed. Please install git and re-run."
    fi
    if [ -d "$INSTALL_DIR" ]; then
      warn "Removing incomplete installation at $INSTALL_DIR..."
      rm -rf "$INSTALL_DIR"
    fi
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi

  checkout_ref "$server_ref"
  ok "Repository ready at $INSTALL_DIR ($server_ref)"

  # Generate .env if needed
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      info "Creating .env from .env.example..."
      cp .env.example .env
      ok "Generated .env"
    else
      info "Creating minimal .env..."
      cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=9430
ENVEOF
      ok "Generated minimal .env"
    fi
  else
    ok "Using existing .env"
  fi

  # Install dependencies and start
  if ! detect_node_runtime; then
    install_bun
    detect_node_runtime
  fi

  info "Installing dependencies..."
  if command_exists bun; then
    bun install
  elif command_exists pnpm; then
    pnpm install
  else
    npm install
  fi

  ok "Dependencies installed"

  info "Starting Ordine server..."
  if command_exists bun; then
    bun run --cwd apps/server start &
  else
    npx --prefix apps/server tsx src/index.ts &
  fi

  # Wait for health check
  info "Waiting for server to be ready..."
  local ready=false
  for i in $(seq 1 30); do
    if curl -sf http://localhost:9430/health >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 2
  done

  if [ "$ready" = true ]; then
    ok "Ordine server is running on http://localhost:9430"
  else
    warn "Server may still be starting. Check logs or try: curl http://localhost:9430/health"
  fi
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------
run_stop() {
  printf "\n"
  info "Stopping Ordine services..."

  # Kill any running server process
  if pgrep -f "ordine.*server" >/dev/null 2>&1; then
    pkill -f "ordine.*server" 2>/dev/null && ok "Server stopped" || true
  elif pgrep -f "bun.*apps/server" >/dev/null 2>&1; then
    pkill -f "bun.*apps/server" 2>/dev/null && ok "Server stopped" || true
  else
    warn "No running Ordine server found"
  fi

  printf "\n"
}

# ---------------------------------------------------------------------------
# Main: Default mode (install / upgrade CLI only)
# ---------------------------------------------------------------------------
run_default() {
  printf "\n"
  printf "${BOLD}  Ordine — Installer${RESET}\n"
  printf "  AI-first meta-orchestration engine\n"
  printf "\n"

  detect_os
  install_cli

  printf "\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "${BOLD}${GREEN}  ✓ Ordine CLI is ready!${RESET}\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  printf "  ${BOLD}Get started:${RESET}\n"
  printf "\n"
  printf "     ${CYAN}ordine init${RESET}           # Initialize a new project\n"
  printf "     ${CYAN}ordine run${RESET}            # Run a pipeline\n"
  printf "     ${CYAN}ordine --help${RESET}         # View all commands\n"
  printf "\n"
  printf "  ${BOLD}Self-hosting?${RESET} Install the server:\n"
  printf "     curl -fsSL https://raw.githubusercontent.com/forge-town/ordine/main/scripts/install.sh | bash -s -- --with-server\n"
  printf "\n"
}

# ---------------------------------------------------------------------------
# Main: With-server mode
# ---------------------------------------------------------------------------
run_with_server() {
  printf "\n"
  printf "${BOLD}  Ordine — Self-Host Installer${RESET}\n"
  printf "  Installing CLI + provisioning server\n"
  printf "\n"

  detect_os
  setup_server
  install_cli

  printf "\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "${BOLD}${GREEN}  ✓ Ordine server is running and CLI is ready!${RESET}\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  printf "  ${BOLD}Server:${RESET}    http://localhost:9430\n"
  printf "  ${BOLD}Server at:${RESET} %s\n" "$INSTALL_DIR"
  printf "\n"
  printf "  ${BOLD}Get started:${RESET}\n"
  printf "\n"
  printf "     ${CYAN}ordine init${RESET}           # Initialize a new project\n"
  printf "     ${CYAN}ordine run${RESET}            # Run a pipeline\n"
  printf "\n"
  printf "  ${BOLD}To stop:${RESET}\n"
  printf "     curl -fsSL https://raw.githubusercontent.com/forge-town/ordine/main/scripts/install.sh | bash -s -- --stop\n"
  printf "\n"
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
main() {
  local mode="default"

  while [ $# -gt 0 ]; do
    case "$1" in
      --with-server) mode="with-server" ;;
      --stop)        mode="stop" ;;
      --help|-h)
        echo "Usage: install.sh [--with-server | --stop]"
        echo ""
        echo "  (default)       Install / upgrade the Ordine CLI"
        echo "  --with-server   Install CLI + provision a self-host server"
        echo "  --stop          Stop a self-hosted installation"
        echo ""
        echo "After installation, run 'ordine --help' to get started."
        exit 0
        ;;
      *) warn "Unknown option: $1" ;;
    esac
    shift
  done

  case "$mode" in
    default)     run_default ;;
    with-server) run_with_server ;;
    stop)        run_stop ;;
  esac
}

main "$@"
