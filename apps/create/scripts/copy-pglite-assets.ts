/**
 * Copy PGlite binary assets (WASM + data) into the SSR output directory.
 *
 * The Vinxi/Nitro SSR bundler inlines PGlite's JavaScript into chunks but does
 * not handle its binary companions (pglite.data, pglite.wasm, initdb.wasm).
 * At runtime these are resolved relative to import.meta.url of the chunk,
 * so they must sit alongside the bundled .mjs files.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const pgliteEntry = require.resolve("@electric-sql/pglite");
const pgliteDistDir = dirname(pgliteEntry);

const SSR_OUT_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "app", "server", "_ssr");

if (!existsSync(SSR_OUT_DIR)) {
  mkdirSync(SSR_OUT_DIR, { recursive: true });
}

const ASSETS = ["pglite.data", "pglite.wasm", "initdb.wasm"];

for (const asset of ASSETS) {
  const src = join(pgliteDistDir, asset);

  if (!existsSync(src)) {
    console.warn(`[copy-pglite-assets] WARNING: ${asset} not found at ${src}`);
    continue;
  }

  const dest = join(SSR_OUT_DIR, asset);
  cpSync(src, dest);
  console.log(`[copy-pglite-assets] Copied ${asset} → ${dest}`);
}
