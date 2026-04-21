#!/usr/bin/env tsx
/**
 * Check that every *Schema.ts file across the entire monorepo follows the rule:
 *   - A file named `FooSchema.ts` must export exactly ONE Zod schema named `FooSchema`
 *   - No other `*Schema` const exports are allowed in the same file
 *   - The schema name must match the filename (minus `.ts`)
 *
 * Scans all `schemas/` directories (and `packages/schemas/src/`) recursively.
 * Ignores: node_modules, .agents, dist, .turbo
 *
 * Usage: tsx scripts/check-schema-exports.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename, relative } from "node:path";

const ROOT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "..",
);

const IGNORE_DIRS = new Set(["node_modules", ".agents", "dist", ".turbo", ".git"]);
const SCHEMA_EXPORT_RE = /export\s+const\s+(\w+Schema)\s*=/g;

interface Violation {
  file: string;
  reason: string;
  details: string[];
}

const violations: Violation[] = [];
let checkedCount = 0;
let dirCount = 0;

function findSchemaDirs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (!entry.isDirectory()) continue;

    if (entry.name === "schemas") {
      results.push(full);
    }
    results.push(...findSchemaDirs(full));
  }
  return results;
}

const schemaDirs = findSchemaDirs(ROOT);

const allSchemaFiles = new Set<string>();
const nonSchemaFiles: string[] = [];

function checkDirFiles(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name === "index.ts") continue;
    if (entry.name.endsWith("Schema.ts")) {
      allSchemaFiles.add(full);
    } else {
      nonSchemaFiles.push(full);
    }
  }
}

for (const dir of schemaDirs) {
  dirCount++;
  checkDirFiles(dir);
  // Also recurse into subdirs of schemas/ (e.g. schemas/nodes/)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      const sub = join(dir, entry.name);
      checkDirFiles(sub);
    }
  }
}

const packagesSchemaSrc = join(ROOT, "packages/schemas/src");
try {
  if (statSync(packagesSchemaSrc).isDirectory()) {
    dirCount++;
    checkDirFiles(packagesSchemaSrc);
  }
} catch {
  // packages/schemas/src doesn't exist, skip
}

const sortedFiles = [...allSchemaFiles].sort();

for (const filePath of sortedFiles) {
  checkedCount++;
  const fileName = basename(filePath, ".ts");
  const relPath = relative(ROOT, filePath);
  const content = readFileSync(filePath, "utf-8");

  const schemaExports: string[] = [];
  let match: RegExpExecArray | null;
  SCHEMA_EXPORT_RE.lastIndex = 0;
  while ((match = SCHEMA_EXPORT_RE.exec(content)) !== null) {
    schemaExports.push(match[1]);
  }

  if (schemaExports.length === 0) {
    violations.push({
      file: relPath,
      reason: "no schema export found",
      details: [`Expected: export const ${fileName}`],
    });
    continue;
  }

  if (!schemaExports.includes(fileName)) {
    violations.push({
      file: relPath,
      reason: "schema name does not match filename",
      details: [
        `Expected: ${fileName}`,
        `Found: ${schemaExports.join(", ")}`,
      ],
    });
  }

  const extras = schemaExports.filter((name) => name !== fileName);
  if (extras.length > 0) {
    violations.push({
      file: relPath,
      reason: "extra schema exports in file",
      details: [
        `Primary: ${fileName}`,
        `Extra: ${extras.join(", ")}`,
        "Each schema must live in its own file.",
      ],
    });
  }
}

console.log(`\nScanned ${dirCount} schema directories, checked ${checkedCount} *Schema.ts files\n`);

if (nonSchemaFiles.length > 0) {
  console.log(`⚠️  Found ${nonSchemaFiles.length} non-schema file(s) in schemas/ directories:\n`);
  for (const f of nonSchemaFiles.sort()) {
    console.log(`  ${relative(ROOT, f)}`);
  }
  console.log("\n  schemas/ directories should only contain *Schema.ts and index.ts files.\n");
  violations.push({
    file: "(multiple)",
    reason: `${nonSchemaFiles.length} non-schema file(s) found in schemas/ directories`,
    details: nonSchemaFiles.map((f) => relative(ROOT, f)),
  });
}

if (violations.length === 0) {
  console.log("✅ All schema files comply with the one-schema-per-file rule.\n");
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.log(`  ${v.file} — ${v.reason}`);
    for (const d of v.details) {
      console.log(`    ${d}`);
    }
    console.log();
  }
  process.exit(1);
}
