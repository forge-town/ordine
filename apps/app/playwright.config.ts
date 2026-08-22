import { defineConfig } from "@playwright/test";

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 9430);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1,
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
    command: `bun run db:push && bunx vite dev --port ${playwrightPort}`,
    env: {
      BETTER_AUTH_SECRET: "ordine-playwright-local-secret-for-e2e-tests",
      NODE_OPTIONS: `--localstorage-file=/tmp/ordine-playwright-${playwrightPort}-localstorage`,
      ORDINE_LOCAL_MODE: "true",
      ORDINE_EXTRA_RUNTIMES: "claude-code:node,codex:node,opencode:node",
      DATABASE_URL:
        process.env.PLAYWRIGHT_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/ordine_playwright",
      RUNTIME_SCAN_MODE: "local",
      VITE_APP_URL: `http://localhost:${playwrightPort}`,
    },
    port: playwrightPort,
    reuseExistingServer: false,
  },
});
