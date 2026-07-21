import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.js'], // e2e/*.spec.js belongs to Playwright
  },
});
