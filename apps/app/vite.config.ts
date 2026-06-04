import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const IS_STORYBOOK = process.argv[1]?.includes("storybook");

export default defineConfig({
  plugins: [
    {
      name: "md-text-import",
      transform(_, id) {
        const filePath = resolve(id.split("?")[0] ?? id);
        if (!filePath.endsWith(".md") || !existsSync(filePath)) {
          return;
        }

        const realFilePath = realpathSync(filePath);

        return {
          code: `export default ${JSON.stringify(readFileSync(realFilePath, "utf8"))}`,
          moduleType: "js",
        };
      },
    },
    ...(!IS_STORYBOOK ? [nitro()] : []),
    tailwindcss(),
    ...(!IS_STORYBOOK ? [tanstackStart()] : []),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
});
