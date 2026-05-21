import { cpSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(import.meta.url.replace("file://", "")), "..");
const RESOURCES_DIR = resolve(ROOT, "src-tauri/resources/server");
const BINARIES_DIR = resolve(ROOT, "src-tauri/binaries");
const PGLITE_DIST = resolve(
  ROOT,
  "../../node_modules/.bun/@electric-sql+pglite@0.4.5/node_modules/@electric-sql/pglite/dist",
);

mkdirSync(RESOURCES_DIR, { recursive: true });
mkdirSync(BINARIES_DIR, { recursive: true });

// 1. Bundle server JS
console.log("Bundling server...");
execSync(
  `bun build ../server/src/desktop-entry.ts --target=bun --outfile ${RESOURCES_DIR}/server-bundle.mjs`,
  { cwd: ROOT, stdio: "inherit" },
);

// 2. Copy PGlite WASM/data files next to bundle
console.log("Copying PGlite runtime files...");
cpSync(resolve(PGLITE_DIST, "pglite.wasm"), resolve(RESOURCES_DIR, "pglite.wasm"));
cpSync(resolve(PGLITE_DIST, "pglite.data"), resolve(RESOURCES_DIR, "pglite.data"));
cpSync(resolve(PGLITE_DIST, "initdb.wasm"), resolve(RESOURCES_DIR, "initdb.wasm"));

// 3. Copy bun binary as sidecar (both architectures for Rosetta)
console.log("Copying bun runtime as sidecar...");
const bunPath = execSync("which bun", { encoding: "utf-8" }).trim();
cpSync(bunPath, resolve(BINARIES_DIR, "ordine-server-aarch64-apple-darwin"));
cpSync(bunPath, resolve(BINARIES_DIR, "ordine-server-x86_64-apple-darwin"));

console.log("Done! Server bundle ready.");
