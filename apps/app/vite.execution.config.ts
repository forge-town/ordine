import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./src/execution-web", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [tailwindcss(), react()],
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-query", "@refinedev/core"] },
  server: { host: "127.0.0.1", port: 9430, strictPort: true },
  preview: { host: "127.0.0.1", port: 9430, strictPort: true },
  build: {
    target: "es2022",
    outDir: fileURLToPath(new URL("./dist-execution", import.meta.url)),
    emptyOutDir: true,
  },
});
