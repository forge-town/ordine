import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "md-text-import",
      transform(_, id) {
        if (id.endsWith(".md")) {
          return `export default ${JSON.stringify(readFileSync(id, "utf8"))}`;
        }
      },
    },
  ],
  test: {
    globals: false,
    environment: "node",
  },
});
