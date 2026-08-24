import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
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
const migrationsTarget = resolve(RESOURCES_DIR, "migrations");
rmSync(migrationsTarget, { force: true, recursive: true });
cpSync(resolve(ROOT, "../create/migrations"), migrationsTarget, { recursive: true });

// 3. Copy bun binary as the server sidecar for the current Tauri target.
console.log("Copying bun runtime as sidecar...");
const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
const targetTriple =
  process.platform === "win32"
    ? `${arch}-pc-windows-msvc`
    : process.platform === "darwin"
      ? `${arch}-apple-darwin`
      : `${arch}-unknown-linux-gnu`;
const executableSuffix = process.platform === "win32" ? ".exe" : "";
cpSync(process.execPath, resolve(BINARIES_DIR, `ordine-server-${targetTriple}${executableSuffix}`));

// 4. Build a standalone MCP sidecar. Client configs point to this absolute
// binary and never depend on a globally-installed `ordine` command.
console.log("Building ordine-mcp sidecar...");
const mcpSidecar = resolve(BINARIES_DIR, `ordine-mcp-${targetTriple}${executableSuffix}`);
execFileSync(
  process.execPath,
  ["build", "../cli/src/mcp-sidecar.ts", "--compile", "--outfile", mcpSidecar],
  { cwd: ROOT, stdio: "inherit" },
);

console.log("Done! Server bundle ready.");
