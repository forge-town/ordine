import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "text-imports",
      enforce: "pre",
      resolveId(id, importer) {
        if (id.endsWith(".md") && importer) {
          return resolve(dirname(importer), id);
        }
      },
      load(id) {
        if (id.endsWith(".md")) {
          const content = readFileSync(id, "utf-8");
          return `export default ${JSON.stringify(content)};`;
        }
      },
    },
  ],
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      PGLITE_DATA_DIR: "/tmp/ordine-test-pglite",
    },
  },
});
