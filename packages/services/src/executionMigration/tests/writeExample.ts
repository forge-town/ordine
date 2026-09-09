import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { migrationFixture } from "./fixtures";

const directory = process.argv[2];
if (!directory || !isAbsolute(directory))
  throw new Error("An explicit absolute output directory is required");
const fixture = migrationFixture();
await mkdir(directory, { recursive: true });
await writeFile(
  resolve(directory, "r11-offline-rebuild-source.example.json"),
  fixture.sourceBytes,
  { flag: "wx" },
);
await writeFile(
  resolve(directory, "r11-offline-rebuild-bundle.example.json"),
  `${JSON.stringify(fixture.bundle, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
console.log("Synthetic manual rebuild source and bundle written; no database was opened.");
