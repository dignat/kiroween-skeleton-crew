import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Guards the MCP security rules for every app, so a generated app cannot quietly widen file access.
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const template = readFileSync(join(repoRoot, 'packages/skeleton/agent-template/mcp-launch.template.sh'), 'utf8');
const appsDir = join(repoRoot, 'apps');
const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(appsDir, entry.name, 'mcp-launch.sh')))
  .map((entry) => entry.name);
/** The executable lines only: no comments, no blank lines. */
const code = (text: string): string[] =>
  text.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
describe('MCP launcher template', () => {
  it('runs from the launcher own folder and never touches the repo root', () => {
    expect(code(template)).toContain('cd "$SCRIPT_DIR"');
    expect(template).not.toMatch(/REPO_ROOT|\.\.\/\.\./);
  });
  it('is found for at least one app', () => {
    expect(apps.length).toBeGreaterThan(0);
  });
});
describe.each(apps)('app %s', (app) => {
  it('mcp-launch.sh has the same commands as the template', () => {
    const launcher = readFileSync(join(appsDir, app, 'mcp-launch.sh'), 'utf8');
    expect(code(launcher)).toEqual(code(template));
  });
  it('mcp-server.ts does not use process.cwd()', () => {
    const server = readFileSync(join(appsDir, app, 'src/mcp-server.ts'), 'utf8');
    expect(server).not.toContain('process.cwd');
  });
});
