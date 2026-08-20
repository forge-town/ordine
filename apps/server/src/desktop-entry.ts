import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runMigrations } from "@ordine/create/migrations";

const DATA_DIR = process.env.ORDINE_DATA_DIR ?? join(homedir(), ".ordine");
const LEGACY_PGLITE_DATA_DIR = join(DATA_DIR, "data");
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");
mkdirSync(DATA_DIR, { recursive: true });

if (existsSync(LEGACY_PGLITE_DATA_DIR)) {
  console.error(
    `[desktop] Legacy PGlite data detected at ${LEGACY_PGLITE_DATA_DIR}. ` +
      "Ordine will not switch to an empty PostgreSQL database automatically. " +
      "Back up and migrate the legacy data, then move the legacy data directory before starting Desktop.",
  );
  process.exit(1);
}

// Generate per-launch auth token for desktop security
const desktopAuthToken = randomBytes(32).toString("hex");
const tokenPath = join(DATA_DIR, ".desktop-token");
writeFileSync(tokenPath, desktopAuthToken, { mode: 0o600 });

// Desktop uses the same Docker PostgreSQL instance as the web application.
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ordine";
process.env.NODE_ENV = "production";
process.env.DESKTOP_MODE = "true";
process.env.DESKTOP_AUTH_TOKEN = desktopAuthToken;

const migrationResult = await runMigrations(process.env.DATABASE_URL, MIGRATIONS_DIR);
if (migrationResult.isErr()) {
  console.error(
    `[desktop] Failed to prepare Docker PostgreSQL: ${migrationResult.error.message}. ` +
      "Start the local PostgreSQL container and verify DATABASE_URL, then retry.",
  );
  process.exit(1);
}

// Now import and start the server.
await import("./index.js");
