import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nativeRustTarget } from "./nativeTarget";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const RESOURCES_DIR = resolve(ROOT, "src-tauri/resources/server");
const BINARIES_DIR = resolve(ROOT, "src-tauri/binaries");

mkdirSync(RESOURCES_DIR, { recursive: true });
mkdirSync(BINARIES_DIR, { recursive: true });

// 1. Bundle server JS
console.log("Bundling server...");
execFileSync(
  process.execPath,
  [
    "build",
    "../server/src/desktop-entry.ts",
    "--target=bun",
    "--outfile",
    resolve(RESOURCES_DIR, "server-bundle.mjs"),
  ],
  { cwd: ROOT, stdio: "inherit" },
);

// 2. Copy PostgreSQL migrations next to the bundled server.
const migrationsTarget = resolve(RESOURCES_DIR, "migrations-v2");
mkdirSync(migrationsTarget, { recursive: true });
cpSync(
  resolve(ROOT, "../create/migrations-v2/0001_execution.sql"),
  resolve(migrationsTarget, "0001_execution.sql"),
);
// Product metadata uses a separate private schema and its own unchanged migration chain.
const authoringMigrationsSource = resolve(ROOT, "../create/migrations");
const authoringMigrationsTarget = resolve(RESOURCES_DIR, "migrations-authoring");
mkdirSync(authoringMigrationsTarget, { recursive: true });
for (const migration of readdirSync(authoringMigrationsSource)
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  cpSync(
    resolve(authoringMigrationsSource, migration),
    resolve(authoringMigrationsTarget, migration),
  );
}
// Bun flattens import.meta.url into this bundle's directory. Keep native launchers adjacent.
const actorsSource = resolve(ROOT, "../../packages/services/src/executionActors");
for (const helper of readdirSync(actorsSource).filter((name) => name.endsWith(".ps1"))) {
  cpSync(resolve(actorsSource, helper), resolve(RESOURCES_DIR, helper));
}

// 3. Copy bun binary as the server sidecar for the current Tauri target.
console.log("Copying bun runtime as sidecar...");
const targetTriple = nativeRustTarget();
const executableSuffix = process.platform === "win32" ? ".exe" : "";
cpSync(process.execPath, resolve(BINARIES_DIR, `ordine-server-${targetTriple}${executableSuffix}`));

// 4. Build a standalone MCP sidecar. Client configs point to this absolute
// binary and never depend on a globally-installed `ordine` command.
console.log("Building ordine-mcp sidecar...");
const mcpSidecar = resolve(BINARIES_DIR, `ordine-mcp-${targetTriple}${executableSuffix}`);
execFileSync(
  process.execPath,
  ["build", "../cli/src/mcp-sidecar.ts", "--compile", "--outfile", mcpSidecar],
  { cwd: ROOT, stdio: "inherit", windowsHide: true },
);

console.log("Done! Server bundle ready.");
