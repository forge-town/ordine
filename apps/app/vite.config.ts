import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const IS_STORYBOOK = process.argv[1]?.includes("storybook");

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
    ...(!IS_STORYBOOK ? [nitro()] : []),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    ...(!IS_STORYBOOK ? [tanstackStart()] : []),
    viteReact(),
  ],
  build: {
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
});
