import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@ordine/cli/mcp-manager": fileURLToPath(
        new URL("../cli/src/mcp/manager.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
