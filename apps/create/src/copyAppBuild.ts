import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "../../app/.output");
const targetDir = join(import.meta.dirname, "../app");

rmSync(targetDir, { force: true, recursive: true });
cpSync(outputDir, targetDir, { recursive: true });
