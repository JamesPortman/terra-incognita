import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.js'], // e2e/*.spec.js belongs to Playwright
    coverage: {
      enabled: true,
      provider: 'v8',
      all: true,
      include: ['api/**/*.js', 'shared/**/*.js'],
      reporter: ['text-summary'],
      // Floor, not target: fails the run (and therefore the deploy) if server
      // code coverage regresses. Raise these as coverage improves; never lower
      // them to get a build through.
      thresholds: { lines: 70, statements: 70, branches: 60, functions: 50 },
    },
  },
});
