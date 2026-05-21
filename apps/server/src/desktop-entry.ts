import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DATA_DIR = join(homedir(), ".ordine");
const PGLITE_DATA_DIR = join(DATA_DIR, "data");

// Ensure data directory exists
if (!existsSync(PGLITE_DATA_DIR)) {
  mkdirSync(PGLITE_DATA_DIR, { recursive: true });
}

// Generate per-launch auth token for desktop security
const desktopAuthToken = randomBytes(32).toString("hex");
const tokenPath = join(DATA_DIR, ".desktop-token");
writeFileSync(tokenPath, desktopAuthToken, { mode: 0o600 });

// Use PGlite embedded database — no external postgres needed
process.env.PGLITE_DATA_DIR = PGLITE_DATA_DIR;
process.env.NODE_ENV = "production";
process.env.DESKTOP_MODE = "true";
process.env.DESKTOP_AUTH_TOKEN = desktopAuthToken;

// Now import and start the server
import("./index.js");
