// Launches the {{APP_DISPLAY_NAME}} MCP server with the project's Node (22). Default launcher, cross-platform.
//
// Register it as { "command": "node", "args": ["<path to this file>"] }   (macOS, Linux, Windows; no sh or nvm.sh needed).
//
// Plain CommonJS, so it starts even on an old Node. It checks the Node version pinned in .nvmrc,
// looks for a matching install in the nvm folders if the default node is too old, and prints a clear
// error to stderr instead of "Connection closed". Logs go to stderr only; stdout belongs to the MCP protocol.
//
// Limit: Kiro must be able to find some `node` on its PATH to run this file. If it cannot (for example
// Kiro opened from the macOS Dock with no node on PATH), use the mcp-launch.sh fallback instead.
// One launcher per app, so each server runs from its own folder.
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const appDir = __dirname;

/** Walks up from the app folder to find .nvmrc and returns its major version (22 if none is found). */
function requiredMajor() {
  let dir = appDir;
  for (;;) {
    const file = path.join(dir, '.nvmrc');
    if (fs.existsSync(file)) {
      const match = /(\d+)/.exec(fs.readFileSync(file, 'utf8'));
      if (match) return Number(match[1]);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return 22;
    dir = parent;
  }
}

/** Compares two version folder names such as v22.9.0 and v22.23.0 by number, not as text. */
function compareVersions(a, b) {
  const pa = a.slice(1).split('.').map(Number);
  const pb = b.slice(1).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
/** Looks for an installed Node of the wanted major in the nvm (macOS, Linux) and nvm-windows folders. */
function findNode(major) {
  const isWindows = process.platform === 'win32';
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const roots = isWindows
    ? [process.env.NVM_HOME]
    : [path.join(process.env.NVM_DIR || path.join(home, '.nvm'), 'versions', 'node')];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    const versions = fs.readdirSync(root).filter((name) => name.startsWith('v' + major + '.')).sort(compareVersions).reverse();
    for (const version of versions) {
      const bin = isWindows ? path.join(root, version, 'node.exe') : path.join(root, version, 'bin', 'node');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return undefined;
}

const major = requiredMajor();
const current = Number(process.versions.node.split('.')[0]);
const nodeBin = current >= major ? process.execPath : findNode(major);

if (!nodeBin) {
  process.stderr.write(
    'MCP server not started: Node ' + major + ' or newer is required (see .nvmrc) but this node is ' + process.versions.node + '. ' +
      'Install Node ' + major + ' with nvm (other version managers are not searched) or make it the default node, then restart the server.\n',
  );
  process.exit(1);
}

try {
  require.resolve('tsx', { paths: [appDir] });
} catch {
  process.stderr.write('MCP server not started: the "tsx" package was not found. Run "pnpm install" in the project root, then restart the server.\n');
  process.exit(1);
}
const child = spawn(nodeBin, ['--import', 'tsx', 'src/mcp-server.ts'], { cwd: appDir, stdio: 'inherit' });
child.on('error', (error) => {
  process.stderr.write('MCP server failed to start: ' + error.message + '\n');
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : code === null ? 1 : code));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
