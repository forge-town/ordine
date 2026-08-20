import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const RESOURCES_DIR = resolve(ROOT, "src-tauri/resources/server");
const BINARIES_DIR = resolve(ROOT, "src-tauri/binaries");

mkdirSync(RESOURCES_DIR, { recursive: true });
mkdirSync(BINARIES_DIR, { recursive: true });

// 1. Bundle server JS
console.log("Bundling server...");
execSync(
  `bun build ../server/src/desktop-entry.ts --target=bun --outfile ${RESOURCES_DIR}/server-bundle.mjs`,
  { cwd: ROOT, stdio: "inherit" },
);

// 2. Copy PostgreSQL migrations next to the bundled server.
const migrationsTarget = resolve(RESOURCES_DIR, "migrations");
rmSync(migrationsTarget, { force: true, recursive: true });
cpSync(resolve(ROOT, "../create/migrations"), migrationsTarget, { recursive: true });

// 3. Copy bun binary as sidecar (macOS only — restrict to current platform)
console.log("Copying bun runtime as sidecar...");
const bunPath = execSync("which bun", { encoding: "utf-8" }).trim();
const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
const targetTriple = `${arch}-apple-darwin`;
cpSync(bunPath, resolve(BINARIES_DIR, `ordine-server-${targetTriple}`));

console.log("Done! Server bundle ready.");
