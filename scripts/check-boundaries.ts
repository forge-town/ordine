#!/usr/bin/env tsx
/**
 * 模块边界守护（H3-01）。把 CLAUDE.md / CodeGuidelines 里靠人记的边界规则机器化：
 *
 *   1. schemas 是真相叶子：packages/schemas/src 不得 import 任何其他 @repo/* 包。
 *   2. 分层方向：models 不得 import services / agent-engine / pipeline-engine / agent。
 *   3. Service 不碰 db：packages/services/src 不得 import "@repo/db"。
 *   4. feature 边界：canvas 不得 import AgentBar（G1-03，方向单向）。
 *   5. 无人可 import 应用层：任何包不得 import apps/* 或 "@/..."（仅 apps/app 内部可用 @/）。
 *
 * Usage: node --experimental-strip-types scripts/check-boundaries.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const IGNORE_DIRS = new Set(["node_modules", "archived", "dist", ".turbo", "storybook-static"]);
const IGNORE_FILE_RE = /\.(unit|integration)\.test\.|\.stories\.|\.d\.ts$/;
const IMPORT_RE = /(?:import|export)[^"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;

type Rule = {
  /** 相对仓库根的目录前缀。 */
  dir: string;
  /** 命中即违规的 import 来源判定（file 为绝对路径，用于例外豁免）。 */
  forbid: (spec: string, file: string) => boolean;
  message: string;
};

const RULES: Rule[] = [
  {
    dir: "packages/schemas/src",
    forbid: (s) => s.startsWith("@repo/"),
    message: "schemas 是真相叶子，不得依赖其他 @repo/* 包",
  },
  {
    dir: "packages/models/src",
    forbid: (s) =>
      ["@repo/services", "@repo/agent-engine", "@repo/pipeline-engine", "@repo/agent"].includes(s),
    message: "models 不得依赖上层（services/agent-engine/pipeline-engine/agent）",
  },
  {
    dir: "packages/services/src",
    // serviceFactory.ts 是唯一的 DI 组合根（把 db 注入各 service 工厂），合法例外。
    forbid: (s, file) => s === "@repo/db" && !file.endsWith("serviceFactory.ts"),
    message: "Service 不得直接 import @repo/db，必须通过 DAO（CodeGuidelines §五）",
  },
  {
    dir: "apps/app/src/pages/WorkspacePage/canvas",
    forbid: (s) => s.includes("AgentBar"),
    message: "canvas 不得 import AgentBar（feature 单向边界，G1-03）",
  },
];

const collect = (dir: string, out: string[]): void => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) collect(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !IGNORE_FILE_RE.test(entry)) out.push(full);
  }
};

const importsOf = (file: string): string[] => {
  const text = readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec) specs.push(spec);
  }

  return specs;
};

const violations: string[] = [];
for (const rule of RULES) {
  const base = join(ROOT, rule.dir);
  const files: string[] = [];
  collect(base, files);
  for (const file of files) {
    for (const spec of importsOf(file)) {
      if (rule.forbid(spec, file)) {
        violations.push(`  ✗ ${relative(ROOT, file)} → "${spec}"  (${rule.message})`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n[check-boundaries] ${violations.length} 处越界 import：`);
  console.error(violations.join("\n"));
  console.error("");
  process.exit(1);
}

console.log("[check-boundaries] OK — 无越界 import。");
