import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    globals: false,
    environment: "node",
    // PostgreSQL migration tests initialize the full schema and need more than the default timeout.
    testTimeout: 30_000,
  },
});
