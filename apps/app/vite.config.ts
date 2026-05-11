import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const IS_STORYBOOK = process.argv[1]?.includes("storybook");
const APP_ROOT = dirname(fileURLToPath(import.meta.url));
const REAL_APP_ROOT = realpathSync(APP_ROOT);

const isInsideAppRoot = (path: string) => {
  const relativePath = relative(REAL_APP_ROOT, path);

  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
};

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
        if (isInsideAppRoot(realFilePath)) {
          return `export default ${JSON.stringify(readFileSync(realFilePath, "utf8"))}`;
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
