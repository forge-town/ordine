import { mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = join(homedir(), ".ordine");
const PGLITE_DATA_DIR = join(DATA_DIR, "data");

// Ensure data directory exists
if (!existsSync(PGLITE_DATA_DIR)) {
  mkdirSync(PGLITE_DATA_DIR, { recursive: true });
}

// Use PGlite embedded database — no external postgres needed
process.env.PGLITE_DATA_DIR = PGLITE_DATA_DIR;
process.env.NODE_ENV = "production";

// Now import and start the server
import("./index.js");
