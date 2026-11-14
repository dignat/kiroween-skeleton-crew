import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// Keeps the package publishable: dev entry points run from src/, published ones from dist/.
const pkgDir = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
  private?: boolean;
  exports: Record<string, string>;
  files: string[];
  publishConfig: { access: string; exports: Record<string, { types: string; default: string }> };
  engines: { node: string };
};
describe('npm package setup', () => {
  it('is not private and publishes publicly', () => {
    expect(pkg.private).not.toBe(true);
    expect(pkg.publishConfig.access).toBe('public');
    expect(pkg.engines.node).toBeTruthy();
  });
  it('publishes the same entry points as it uses in the repo, compiled into dist/', () => {
    expect(Object.keys(pkg.publishConfig.exports)).toEqual(Object.keys(pkg.exports));
    for (const [entry, dev] of Object.entries(pkg.exports)) {
      const published = pkg.publishConfig.exports[entry]!;
      expect(published.default).toBe(dev.replace('./src/', './dist/').replace(/\.ts$/, '.js'));
      expect(published.types).toBe(published.default.replace(/\.js$/, '.d.ts'));
    }
  });
  it('ships the templates, README and LICENSE, and never the tests', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'agent-template', 'README.md', 'LICENSE']));
    for (const file of ['README.md', 'LICENSE', 'tsconfig.build.json']) expect(existsSync(join(pkgDir, file))).toBe(true);
    const build = readFileSync(join(pkgDir, 'tsconfig.build.json'), 'utf8');
    expect(build).toContain('src/tests');
    expect(build).toContain('*.test.ts');
  });
});

// The package is `@skeleton-playground/core`. Earlier names (a scope owned by someone else, and a
// personal-scope stopgap) must not reappear.
// Built from pieces so this file does not contain the old names itself.
const OLD_NAMES = [['@skeleton-crew', 'core'].join('/'), ['@dignat', 'skeleton-core'].join('/')];
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|json|md|sh)$/.test(name)) out.push(full);
  }
  return out;
}
describe('package name', () => {
  it('is @skeleton-playground/core, and nothing in the repo still uses an old name', () => {
    expect(JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).name).toBe('@skeleton-playground/core');
    const root = join(pkgDir, '../..');
    const files = ['apps', 'packages', '.kiro'].flatMap((d) => walk(join(root, d))).concat(join(root, 'README.md'));
    const offenders = files.filter((f) => OLD_NAMES.some((name) => readFileSync(f, 'utf8').includes(name)));
    expect(offenders).toEqual([]);
  });
});

// What a stranger reads on the npm page, and what they copy into their own project, must not
// assume this repository's layout.
describe('published text works outside this repo', () => {
  const readme = readFileSync(join(pkgDir, 'README.md'), 'utf8');
  const reviewer = readFileSync(join(pkgDir, 'agent-template/security-reviewer.template.json'), 'utf8');
  const launcher = readFileSync(join(pkgDir, 'agent-template/mcp-launch.template.sh'), 'utf8');
  const REPO_ONLY = ['workspace:*', 'apps/<', 'apps/my-app', '../../../', 'repo root', 'packages/skeleton', 'pnpm test', 'maintainers', 'mcp-security.test'];
  it('README has no monorepo-only instructions', () => {
    for (const text of REPO_ONLY) expect(readme, text).not.toContain(text);
  });
  it('README documents the required allowedRoot, the model download and the install size', () => {
    expect(readme).toContain('allowedRoot');
    expect(readme).toMatch(/downloaded the first time/i);
    expect(readme).toMatch(/\b280 MB\b/);
  });
  it('the monorepo how-to lives in DEVELOPING.md, which is not shipped', () => {
    expect(existsSync(join(pkgDir, 'DEVELOPING.md'))).toBe(true);
    expect(pkg.files).not.toContain('DEVELOPING.md');
  });
  it('the reviewer template and launcher template do not name repo-only paths', () => {
    for (const text of ['packages/skeleton/', 'mcp-security.test', 'apps/*', 'Skeleton Crew monorepo', '.kiro/steering/project-structure']) {
      expect(reviewer, text).not.toContain(text);
      expect(launcher, text).not.toContain(text);
    }
  });
});
