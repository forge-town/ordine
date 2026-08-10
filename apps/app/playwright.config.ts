import { defineConfig } from "@playwright/test";

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 9430);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${playwrightPort}`,
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `bunx vite dev --port ${playwrightPort}`,
    env: {
      BETTER_AUTH_SECRET: "ordine-playwright-local-secret-for-e2e-tests",
      NODE_OPTIONS: `--localstorage-file=/tmp/ordine-playwright-${playwrightPort}-localstorage`,
      ORDINE_LOCAL_MODE: "true",
      PGLITE_DATA_DIR: `/tmp/ordine-playwright-${playwrightPort}-db`,
      PGLITE_MIGRATIONS_DIR: "../create/migrations",
      VITE_APP_URL: `http://localhost:${playwrightPort}`,
    },
    port: playwrightPort,
    reuseExistingServer: true,
  },
});
