import { defineConfig } from 'vitest/config';

// One test run for the whole workspace. Tests live next to the code as *.test.ts.
// When the web UI needs a browser-like environment (task 20), switch to Vitest projects.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Coverage is reported for the shared skeleton, the part every app depends on.
      include: ['packages/skeleton/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/test-helpers.ts', '**/stdio-fixture.ts'],
      reporter: ['text', 'html'],
    },
  },
});
