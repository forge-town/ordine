import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [tanstackRouter({ routesDirectory: "./src/routes" }), tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 9431,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 9432 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
