#!/bin/sh
# Launches the Poltergeist Detector MCP server with the project's Node (22).
#
# Kiro spawns MCP servers in a minimal environment that may not have run `nvm use`,
# so the default `node` on PATH can be too old for the MCP SDK (needs Node 20+).
# This script loads nvm, selects the version in the repo's .nvmrc, and execs the
# server. Logs go to stderr only; stdout stays clean for the MCP protocol.
#
# Referenced by .kiro/settings/mcp.json. Works on any machine with nvm installed.
# One launcher per app (see .kiro/steering/project-structure.md); no shared root script.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Run from this app's own folder, never the repo root. The server finds its images folder
# (samples/) from its own file location, so nothing depends on the working directory.
cd "$SCRIPT_DIR"
# Load nvm (honour NVM_DIR, fall back to the default install location).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh" >&2
  # Use the version pinned in .nvmrc (found by walking up from here); fall back to the default alias.
  nvm use >&2 2>/dev/null || nvm use default >&2 2>/dev/null || true
fi
exec node --import tsx src/mcp-server.ts
