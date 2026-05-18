import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    exclude: ["**/archived/**", "**/node_modules/**"],
  },
});
