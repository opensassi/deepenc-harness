import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.test.ts',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
  },
});
