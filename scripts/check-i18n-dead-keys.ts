#!/usr/bin/env tsx
/**
 * i18n 死键与双语 parity 检查（G1-05）。
 *
 * 规则：
 *   1. en.json 与 zh.json 的键集合必须完全一致（双语同步加键是硬性要求）。
 *   2. locales 中的每个键必须在 apps/app/src 活跃源码中被引用，否则视为死键。
 *
 * 引用判定（保守，避免误杀动态键）：
 *   - 精确引用：源码中任何形如 "a.b.c" 的字符串字面量。
 *   - 前缀引用：模板键（如 `jobs.table.actions.${action}Done`）取 `${` 前的静态前缀，
 *     凡以该前缀开头的键都算被引用。
 *
 * 扫描范围排除：archived、测试、stories、d.ts。
 *
 * Usage: node --experimental-strip-types scripts/check-i18n-dead-keys.ts （或 tsx）
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const SRC = join(ROOT, "apps/app/src");
const LOCALES = join(SRC, "locales");

const IGNORE_DIRS = new Set(["archived", "node_modules", "locales", "test"]);
const IGNORE_FILE_RE = /\.(unit|integration)\.test\.|\.stories\.|\.d\.ts$/;
const KEY_LITERAL_RE = /["'`]([a-z][\w-]*(?:\.[\w-]+)+)["'`]/g;
const TEMPLATE_PREFIX_RE = /[`"']([a-z][\w-]*(?:\.[\w-]+)*\.)\$\{/g;

const flattenKeys = (obj: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return typeof value === "object" && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });

const collectSources = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) collectSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !IGNORE_FILE_RE.test(entry)) {
      out.push(full);
    }
  }
};

const enKeys = flattenKeys(JSON.parse(readFileSync(join(LOCALES, "en.json"), "utf8")));
const zhKeys = flattenKeys(JSON.parse(readFileSync(join(LOCALES, "zh.json"), "utf8")));

const enSet = new Set(enKeys);
const zhSet = new Set(zhKeys);
const missingInZh = enKeys.filter((key) => !zhSet.has(key));
const missingInEn = zhKeys.filter((key) => !enSet.has(key));

const files: string[] = [];
collectSources(SRC, files);

const usedExact = new Set<string>();
const usedPrefixes = new Set<string>();
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(KEY_LITERAL_RE)) {
    usedExact.add(match[1]!);
  }
  for (const match of content.matchAll(TEMPLATE_PREFIX_RE)) {
    usedPrefixes.add(match[1]!);
  }
}

const prefixes = [...usedPrefixes];
const PLURAL_SUFFIX_RE = /_(?:zero|one|two|few|many|other)$/;
const isAlive = (key: string): boolean =>
  usedExact.has(key) || prefixes.some((prefix) => key.startsWith(prefix));
const deadKeys = enKeys.filter(
  (key) => !isAlive(key) && !(PLURAL_SUFFIX_RE.test(key) && isAlive(key.replace(PLURAL_SUFFIX_RE, ""))),
);

const FIX = process.argv.includes("--fix");
if (FIX) {
  const deadSet = new Set(deadKeys);
  const zhDead = zhKeys.filter((key) => !enSet.has(key) && !isAlive(key));
  for (const key of zhDead) deadSet.add(key);
  const prune = (obj: Record<string, unknown>, prefix = ""): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        const child = prune(value as Record<string, unknown>, path);
        if (Object.keys(child).length > 0) out[key] = child;
      } else if (!deadSet.has(path)) {
        out[key] = value;
      }
    }

    return out;
  };
  for (const file of ["en.json", "zh.json"]) {
    const full = join(LOCALES, file);
    const pruned = prune(JSON.parse(readFileSync(full, "utf8")));
    writeFileSync(full, `${JSON.stringify(pruned, null, 2)}\n`);
  }
  console.log(`--fix: 已从双语文件修剪 ${deadSet.size} 个死键`);
  process.exit(0);
}

let failed = false;
if (missingInZh.length > 0 || missingInEn.length > 0) {
  failed = true;
  console.error(`✗ 双语 parity 失败：zh 缺 ${missingInZh.length} 键，en 缺 ${missingInEn.length} 键`);
  for (const key of [...missingInZh.map((k) => `zh 缺: ${k}`), ...missingInEn.map((k) => `en 缺: ${k}`)]) {
    console.error(`  - ${key}`);
  }
}
if (deadKeys.length > 0) {
  failed = true;
  console.error(`✗ 发现 ${deadKeys.length} 个死键（en.json 中无任何源码引用）：`);
  for (const key of deadKeys) console.error(`  - ${key}`);
}

if (failed) {
  process.exit(1);
}
console.log(`✓ i18n 检查通过：${enKeys.length} 键，双语一致，无死键（扫描 ${files.length} 文件）`);
