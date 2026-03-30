#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Pico Server Installer
#
#  Install:   curl -fsSL https://raw.githubusercontent.com/anthaathi/pi-companion/main/install.sh | bash
#  Uninstall: curl -fsSL ... | bash -s -- --uninstall
#
#  Options:
#    --yes          Skip confirmation prompts (auto-accept)
#    --no-service   Skip service installation
#    --uninstall    Remove pi-server and its service
#    --help         Show this help
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────

REPO="anthaathi/pi-companion"
GITHUB_API="https://api.github.com/repos/${REPO}"
GITHUB_RELEASES="https://github.com/${REPO}/releases"

INSTALL_DIR="${HOME}/.pi/ui"
BINARY="pi-server"
WRAPPER="pi-server-wrapper.sh"

SYSTEMD_UNIT_DIR="${HOME}/.config/systemd/user"
SYSTEMD_SERVICE="pi-server.service"

LAUNCHD_AGENTS_DIR="${HOME}/Library/LaunchAgents"
LAUNCHD_LABEL="co.anthaathi.pi-server"
LAUNCHD_PLIST="${LAUNCHD_LABEL}.plist"

# ── Options ──────────────────────────────────────────────────────────────────

OPT_YES=false
OPT_NO_SERVICE=false
OPT_UNINSTALL=false

# ── Terminal helpers ─────────────────────────────────────────────────────────

has_tty() { [ -t 0 ] || [ -t 2 ]; }

# When piped through `| bash`, stdin is the pipe.  We need /dev/tty for
# interactive prompts.
tty_fd() {
  if [ -t 0 ]; then
    echo "/dev/stdin"
  elif [ -r /dev/tty ] && (: < /dev/tty) 2>/dev/null; then
    echo "/dev/tty"
  else
    echo ""
  fi
}

can_read_from() {
  local input="$1"
  [ -n "$input" ] && (: < "$input") 2>/dev/null
}

supports_color() {
  [ -t 1 ] && [ "${TERM:-dumb}" != "dumb" ]
}

if supports_color; then
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RESET=$'\033[0m'
  BLUE=$'\033[34m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  CYAN=$'\033[36m'
else
  BOLD="" DIM="" RESET="" BLUE="" GREEN="" YELLOW="" RED="" CYAN=""
fi

header()  { printf "\n${BOLD}${BLUE}  %s${RESET}\n\n" "$*"; }
info()    { printf "  ${GREEN}▸${RESET} %s\n" "$*"; }
warn()    { printf "  ${YELLOW}▸${RESET} %s\n" "$*"; }
err()     { printf "  ${RED}✘${RESET} %s\n" "$*" >&2; }
dim()     { printf "  ${DIM}%s${RESET}\n" "$*"; }
success() { printf "\n  ${GREEN}✔${RESET} ${BOLD}%s${RESET}\n" "$*"; }
fatal()   { err "$@"; exit 1; }

# ── Utilities ────────────────────────────────────────────────────────────────

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fatal "Required command '$1' not found. Please install it and try again."
  fi
}

confirm() {
  local prompt="$1" default="${2:-y}"
  if "$OPT_YES"; then return 0; fi

  local tty
  tty="$(tty_fd)"
  if [ -z "$tty" ]; then
    # Non-interactive – use default
    [ "$default" = "y" ] && return 0 || return 1
  fi

  local hint
  if [ "$default" = "y" ]; then hint="Y/n"; else hint="y/N"; fi
  printf "  ${CYAN}?${RESET} ${BOLD}%s${RESET} ${DIM}[%s]${RESET} " "$prompt" "$hint"

  local answer
  read -r answer < "$tty" || answer=""
  answer="${answer:-$default}"

  case "$answer" in
    [Yy]*) return 0 ;;
    *)     return 1 ;;
  esac
}

cleanup() {
  if [ -n "${TMPFILE:-}" ] && [ -f "$TMPFILE" ]; then
    rm -f "$TMPFILE"
  fi
}

trap cleanup EXIT

# ── Platform detection ───────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Linux)  echo "linux" ;;
    Darwin) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) fatal "Unsupported operating system: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64)  echo "x86_64" ;;
    aarch64|arm64)  echo "aarch64" ;;
    *) fatal "Unsupported architecture: $(uname -m)" ;;
  esac
}

# ── GitHub API ───────────────────────────────────────────────────────────────

fetch_latest_tag() {
  local os="$1" arch="$2"
  local artifact="pi-server-${os}-${arch}"

  local response
  response="$(curl -fsSL -H "Accept: application/vnd.github.v3+json" \
    "${GITHUB_API}/releases?per_page=5" 2>/dev/null)" \
    || fatal "Failed to fetch release info from GitHub. Check your internet connection."

  local tags
  tags="$(printf '%s' "$response" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"

  [ -n "$tags" ] || fatal "Could not determine any release tags.\n         Check ${GITHUB_RELEASES} manually."

  for tag in $tags; do
    local url="${GITHUB_RELEASES}/download/${tag}/${artifact}"
    local http_code
    http_code="$(curl -fsSL -o /dev/null -w "%{http_code}" --head "$url" 2>/dev/null)" || true
    if [ "$http_code" = "200" ] || [ "$http_code" = "302" ]; then
      echo "$tag"
      return
    fi
    true
  done

  fatal "No release found with a binary for your platform (${os}/${arch}).\n         Builds may still be in progress. Try again in a few minutes."
}

get_download_url() {
  local tag="$1" os="$2" arch="$3"
  local artifact="pi-server-${os}-${arch}"
  echo "${GITHUB_RELEASES}/download/${tag}/${artifact}"
}

# ── Installed version ────────────────────────────────────────────────────────

installed_version() {
  local bin="${INSTALL_DIR}/${BINARY}"
  if [ -x "$bin" ]; then
    "$bin" --version 2>/dev/null | head -1 || echo "unknown"
  else
    echo ""
  fi
}

# ── Download & install ───────────────────────────────────────────────────────

download_binary() {
  local url="$1" dest="$2"

  TMPFILE="$(mktemp "${TMPDIR:-/tmp}/pi-server-XXXXXX")"

  info "Downloading from ${DIM}${url}${RESET}"

  local http_code
  http_code="$(curl -fSL -w "%{http_code}" -o "$TMPFILE" "$url" 2>/dev/null)" || true

  case "$http_code" in
    200) ;;
    404) fatal "Release artifact not found (HTTP 404).\n         No binary for your platform at:\n         ${url}" ;;
    *)   fatal "Download failed (HTTP ${http_code}).\n         URL: ${url}" ;;
  esac

  [ -s "$TMPFILE" ] || fatal "Downloaded file is empty."

  mkdir -p "$(dirname "$dest")"
  mv "$TMPFILE" "$dest"
  chmod +x "$dest"
}

# ── Service: systemd (Linux) ────────────────────────────────────────────────

has_systemd_user() {
  command -v systemctl &>/dev/null \
    && systemctl --user status &>/dev/null 2>&1
}

is_systemd_installed() {
  [ -f "${SYSTEMD_UNIT_DIR}/${SYSTEMD_SERVICE}" ]
}

install_systemd() {
  local bin="${INSTALL_DIR}/${BINARY}"

  mkdir -p "$SYSTEMD_UNIT_DIR"
  cat > "${SYSTEMD_UNIT_DIR}/${SYSTEMD_SERVICE}" <<EOF
[Unit]
Description=Pico Server – companion server for pi-coding-agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/${WRAPPER}
WorkingDirectory=${INSTALL_DIR}
Restart=on-failure
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pi-server

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now "$SYSTEMD_SERVICE" >/dev/null 2>&1

  success "Service installed and started"
  echo ""
  dim "  Manage the service with:"
  dim "    systemctl --user status  ${SYSTEMD_SERVICE}"
  dim "    systemctl --user stop    ${SYSTEMD_SERVICE}"
  dim "    systemctl --user restart ${SYSTEMD_SERVICE}"
  dim "    journalctl --user -u ${SYSTEMD_SERVICE} -f"
}

restart_systemd() {
  systemctl --user daemon-reload
  systemctl --user restart "$SYSTEMD_SERVICE" >/dev/null 2>&1
  info "Service restarted with new version"
}

remove_systemd() {
  if ! is_systemd_installed; then return; fi
  info "Stopping and removing systemd service..."
  systemctl --user stop "$SYSTEMD_SERVICE" 2>/dev/null || true
  systemctl --user disable "$SYSTEMD_SERVICE" 2>/dev/null || true
  rm -f "${SYSTEMD_UNIT_DIR}/${SYSTEMD_SERVICE}"
  systemctl --user daemon-reload
  info "systemd service removed"
}

# ── Service: launchd (macOS) ────────────────────────────────────────────────

is_launchd_installed() {
  [ -f "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}" ]
}

install_launchd() {
  local bin="${INSTALL_DIR}/${BINARY}"
  local log="${INSTALL_DIR}/pi-server.log"
  local uid
  uid="$(id -u)"

  mkdir -p "$LAUNCHD_AGENTS_DIR"
  cat > "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/${WRAPPER}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${INSTALL_DIR}</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>5</integer>

  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
</dict>
</plist>
EOF

  launchctl bootout "gui/${uid}" "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}" 2>/dev/null || true
  launchctl bootstrap "gui/${uid}" "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}"

  success "Service installed and started"
  echo ""
  dim "  Manage the service with:"
  dim "    launchctl kickstart -k gui/${uid}/${LAUNCHD_LABEL}   # restart"
  dim "    launchctl bootout gui/${uid} ${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}   # stop"
  dim "    tail -f ${log}   # logs"
}

restart_launchd() {
  local uid
  uid="$(id -u)"
  launchctl kickstart -k "gui/${uid}/${LAUNCHD_LABEL}" 2>/dev/null || true
  info "Service restarted with new version"
}

remove_launchd() {
  if ! is_launchd_installed; then return; fi
  local uid
  uid="$(id -u)"
  info "Stopping and removing launchd service..."
  launchctl bootout "gui/${uid}" "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}" 2>/dev/null || true
  rm -f "${LAUNCHD_AGENTS_DIR}/${LAUNCHD_PLIST}"
  info "launchd service removed"
}

# ── Service dispatcher ───────────────────────────────────────────────────────

service_is_installed() {
  local os="$1"
  case "$os" in
    linux) is_systemd_installed ;;
    macos) is_launchd_installed ;;
    *)     return 1 ;;
  esac
}

service_install() {
  local os="$1"
  case "$os" in
    linux)
      if has_systemd_user; then
        install_systemd
      else
        warn "systemd user session not available."
        warn "You can run pi-server manually instead."
      fi
      ;;
    macos)
      install_launchd
      ;;
  esac
}

service_restart() {
  local os="$1"
  case "$os" in
    linux) has_systemd_user && is_systemd_installed && restart_systemd ;;
    macos) is_launchd_installed && restart_launchd ;;
  esac
}

service_remove() {
  local os="$1"
  case "$os" in
    linux) remove_systemd ;;
    macos) remove_launchd ;;
  esac
}

# ── Shell profile ────────────────────────────────────────────────────────────

detect_shell_profile() {
  local shell_name
  shell_name="$(basename "${SHELL:-/bin/bash}")"

  case "$shell_name" in
    zsh)
      if [ -f "${HOME}/.zshrc" ]; then
        echo "${HOME}/.zshrc"
      else
        echo "${HOME}/.zprofile"
      fi
      ;;
    bash)
      if [ -f "${HOME}/.bashrc" ]; then
        echo "${HOME}/.bashrc"
      elif [ -f "${HOME}/.bash_profile" ]; then
        echo "${HOME}/.bash_profile"
      else
        echo "${HOME}/.profile"
      fi
      ;;
    fish)
      echo "${HOME}/.config/fish/config.fish"
      ;;
    *)
      echo "${HOME}/.profile"
      ;;
  esac
}

path_entry_exists() {
  local profile="$1"
  [ -f "$profile" ] && grep -qF "${INSTALL_DIR}" "$profile" 2>/dev/null
}

add_to_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qxF "$INSTALL_DIR"; then
    return 0  # already on PATH
  fi

  local profile
  profile="$(detect_shell_profile)"

  if path_entry_exists "$profile"; then
    return 0  # already in profile
  fi

  if confirm "Add ${INSTALL_DIR} to PATH in $(basename "$profile")?" "y"; then
    local shell_name
    shell_name="$(basename "${SHELL:-/bin/bash}")"

    echo "" >> "$profile"
    echo "# Pico Server" >> "$profile"

    if [ "$shell_name" = "fish" ]; then
      echo "set -gx PATH \"${INSTALL_DIR}\" \$PATH" >> "$profile"
    else
      echo "export PATH=\"${INSTALL_DIR}:\$PATH\"" >> "$profile"
    fi

    info "Added to ${profile}"
    dim "  Run 'source ${profile}' or open a new terminal to use 'pi-server' directly."
  else
    dim "  You can add it manually:"
    dim "    export PATH=\"${INSTALL_DIR}:\$PATH\""
  fi
}

# ── Wrapper script (for service env) ────────────────────────────────────────

create_wrapper_script() {
  local bin="${INSTALL_DIR}/${BINARY}"
  local wrapper="${INSTALL_DIR}/${WRAPPER}"
  local user_shell
  user_shell="$(basename "${SHELL:-/bin/bash}")"
  local shell_path
  shell_path="${SHELL:-/bin/bash}"

  if [ "$user_shell" = "fish" ]; then
    cat > "$wrapper" <<EOF
#!/usr/bin/env bash
exec ${shell_path} -lc "exec ${bin}"
EOF
  else
    cat > "$wrapper" <<EOF
#!/usr/bin/env bash
exec ${shell_path} -lc 'exec "\$1"' _ "${bin}"
EOF
  fi

  chmod +x "$wrapper"
}

# ── Uninstall ────────────────────────────────────────────────────────────────

do_uninstall() {
  local os
  os="$(detect_os)"

  header "Uninstalling Pico Server"

  if [ ! -d "$INSTALL_DIR" ] && ! service_is_installed "$os"; then
    info "Nothing to uninstall – pi-server is not installed."
    exit 0
  fi

  if ! confirm "This will remove pi-server and its service. Continue?" "y"; then
    info "Cancelled."
    exit 0
  fi

  service_remove "$os"

  if [ -d "$INSTALL_DIR" ]; then
    info "Removing ${INSTALL_DIR}..."
    rm -rf "$INSTALL_DIR"
    info "Files removed"
  fi

  # Clean PATH entry from shell profile
  local profile
  profile="$(detect_shell_profile)"
  if [ -f "$profile" ] && grep -qF "${INSTALL_DIR}" "$profile" 2>/dev/null; then
    # Remove the PATH line and the comment above it
    local tmp
    tmp="$(mktemp)"
    grep -v "# Pico Server" "$profile" | grep -v "${INSTALL_DIR}" > "$tmp" || true
    mv "$tmp" "$profile"
    info "Removed PATH entry from ${profile}"
  fi

  success "Pico Server has been uninstalled"
}

# ── Runtime dependency detection ─────────────────────────────────────────────

detect_and_install_deps() {
  info "Checking runtime dependencies..."
  echo ""

  # Node.js
  if command -v node &>/dev/null; then
    local node_path node_ver
    node_path="$(command -v node)"
    node_ver="$(node --version 2>/dev/null || echo 'unknown')"
    info "Node.js: ${GREEN}${node_ver}${RESET} (${DIM}${node_path}${RESET})"
  else
    err "Node.js is not installed."
    dim "  Install from: https://nodejs.org"
    dim "  Or use nvm:   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    fatal "Node.js is required. Install it and run this script again."
  fi

  # npm
  if command -v npm &>/dev/null; then
    local npm_path npm_ver
    npm_path="$(command -v npm)"
    npm_ver="$(npm --version 2>/dev/null || echo 'unknown')"
    info "npm: ${GREEN}${npm_ver}${RESET} (${DIM}${npm_path}${RESET})"
  else
    err "npm is not installed."
    fatal "npm is required (comes with Node.js). Install Node.js and try again."
  fi

  # pi-coding-agent
  if command -v pi &>/dev/null; then
    local pi_path pi_ver
    pi_path="$(command -v pi)"
    pi_ver="$(pi --version 2>/dev/null | head -1 || echo 'unknown')"
    info "pi: ${GREEN}${pi_ver}${RESET} (${DIM}${pi_path}${RESET})"
  else
    warn "pi-coding-agent is not installed."
    if confirm "Install pi-coding-agent via npm?" "y"; then
      info "Running: npm install -g @mariozechner/pi-coding-agent"
      if npm install -g @mariozechner/pi-coding-agent; then
        local pi_path pi_ver
        pi_path="$(command -v pi 2>/dev/null || echo 'unknown')"
        pi_ver="$(pi --version 2>/dev/null | head -1 || echo 'unknown')"
        success "pi-coding-agent installed: ${pi_ver} (${pi_path})"
      else
        err "Failed to install pi-coding-agent."
        dim "  Try manually: npm install -g @mariozechner/pi-coding-agent"
      fi
    else
      dim "  Install later: npm install -g @mariozechner/pi-coding-agent"
    fi
  fi

  echo ""
}

update_config_paths() {
  local config_file="${INSTALL_DIR}/config.toml"
  [ -f "$config_file" ] || return 0

  local node_path npm_path pi_path
  node_path="$(command -v node 2>/dev/null || true)"
  npm_path="$(command -v npm 2>/dev/null || true)"
  pi_path="$(command -v pi 2>/dev/null || true)"

  [ -z "$node_path" ] && [ -z "$npm_path" ] && [ -z "$pi_path" ] && return 0

  # Remove existing [paths] section if present
  if grep -q '^\[paths\]' "$config_file" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    awk '
      /^\[paths\]/ { skip=1; next }
      /^\[/         { skip=0 }
      !skip          { print }
    ' "$config_file" > "$tmp"
    mv "$tmp" "$config_file"
  fi

  # Append [paths] section
  printf '\n[paths]\n' >> "$config_file"
  [ -n "$node_path" ] && printf 'node = "%s"\n' "$node_path" >> "$config_file"
  [ -n "$npm_path" ]  && printf 'npm = "%s"\n' "$npm_path" >> "$config_file"
  [ -n "$pi_path" ]   && printf 'pi = "%s"\n' "$pi_path" >> "$config_file"

  info "Updated [paths] in config.toml"
}

# ── Install ──────────────────────────────────────────────────────────────────

do_install() {
  local os arch
  os="$(detect_os)"
  arch="$(detect_arch)"

  [ "$os" = "windows" ] && fatal "This installer does not support Windows.\n         Download the binary manually from ${GITHUB_RELEASES}"

  require_cmd curl
  require_cmd grep
  require_cmd sed
  require_cmd mktemp

  header "Pico Server Installer"

  info "Platform: ${os}/${arch}"

  # Fetch latest version
  info "Checking latest release..."
  local tag
  tag="$(fetch_latest_tag "$os" "$arch")"
  info "Latest version: ${BOLD}${tag}${RESET}"

  # Check existing installation
  local current
  current="$(installed_version)"
  if [ -n "$current" ]; then
    info "Currently installed: ${current}"
    if [ "$current" = "$tag" ]; then
      success "Already up to date (${tag})"
      exit 0
    fi
    if ! confirm "Update from ${current} to ${tag}?" "y"; then
      info "Skipped."
      exit 0
    fi
  fi

  # Download
  echo ""
  local url
  url="$(get_download_url "$tag" "$os" "$arch")"
  download_binary "$url" "${INSTALL_DIR}/${BINARY}"

  success "Installed ${BINARY} to ${INSTALL_DIR}"
  echo ""

  # Detect runtime dependencies
  detect_and_install_deps

  # First-time setup
  if [ ! -f "${INSTALL_DIR}/config.toml" ]; then
    local tty
    tty="$(tty_fd)"
    if can_read_from "$tty"; then
      info "Setting up pi-server for the first time..."
      echo ""
      (cd "$INSTALL_DIR" && "./${BINARY}" init < "$tty")
      echo ""
    else
      warn "No interactive terminal detected for first-time setup."
      info "Run 'cd ${INSTALL_DIR} && ./${BINARY} init' to set up credentials."
    fi
  fi

  # Write resolved paths to config.toml (after init creates it)
  update_config_paths

  # Generate wrapper script that sources user shell env
  create_wrapper_script

  # Service setup
  if ! "$OPT_NO_SERVICE"; then
    if service_is_installed "$os"; then
      service_restart "$os"
    else
      echo ""
      if confirm "Install pi-server as a background service (starts on login)?" "y"; then
        echo ""
        service_install "$os"
      else
        echo ""
        dim "  Run manually with:"
        dim "    cd ${INSTALL_DIR} && ./${BINARY}"
      fi
    fi
  fi

  # PATH
  echo ""
  add_to_path

  echo ""
  success "All done!"
  dim "  Scan the QR code from the Pico app to connect."
  echo ""
}

# ── Entry point ──────────────────────────────────────────────────────────────

main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes|-y)        OPT_YES=true ;;
      --no-service)    OPT_NO_SERVICE=true ;;
      --uninstall)     OPT_UNINSTALL=true ;;
      --help|-h)
        printf "Usage: %s [OPTIONS]\n\n" "$0"
        printf "Options:\n"
        printf "  --yes, -y      Skip confirmation prompts\n"
        printf "  --no-service   Skip service installation\n"
        printf "  --uninstall    Remove pi-server and its service\n"
        printf "  --help, -h     Show this help\n"
        exit 0
        ;;
      *)
        warn "Unknown option: $1"
        ;;
    esac
    shift
  done

  if "$OPT_UNINSTALL"; then
    do_uninstall
  else
    do_install
  fi
}

main "$@"
