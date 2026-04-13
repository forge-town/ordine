/**
 * Seed: Rules
 *
 * Seeds basic code quality rules with check scripts across categories:
 *   - lint: no-console-log, no-unused-imports, no-any
 *   - security: no-eval, no-hardcoded-secrets
 *   - style: consistent-naming, max-file-length
 *   - performance: no-n-plus-one, lazy-load-images
 *   - custom: barrel-export-only
 *
 * Each rule has a `checkScript` (bash/python/js) that runs against $INPUT_PATH.
 * Exit code 0 = pass, non-zero = fail.
 */

import { apiPut } from "../api";

interface RuleSeed {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  checkScript: string;
  scriptLanguage: string;
  acceptedObjectTypes?: string[];
  enabled?: boolean;
  tags?: string[];
}

// ─── Rules Data ──────────────────────────────────────────────────────────────

const RULES: RuleSeed[] = [
  // ── Lint ──
  {
    id: "rule_no_console_log",
    name: "No console.log",
    description:
      "禁止在生产代码中使用 console.log，调试完成后必须清除。如需保留日志，使用项目统一的 logger 工具。",
    category: "lint",
    severity: "warning",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx|js)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (/\\bconsole\\.log\\(/.test(src)) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder", "project"],
    enabled: true,
    tags: ["debug", "cleanup"],
  },
  {
    id: "rule_no_unused_imports",
    name: "No unused imports",
    description:
      "所有 import 语句必须在文件中实际使用，未使用的导入会增加打包体积并降低代码可读性。",
    category: "lint",
    severity: "warning",
    checkScript: `import { execSync } from "child_process";
interface RuleTarget { path: string; type: string }
export default function check(target: RuleTarget): boolean {
  try {
    execSync(\`npx oxlint --deny no-unused-vars "\${target.path}"\`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder"],
    enabled: true,
    tags: ["imports", "cleanup"],
  },
  {
    id: "rule_no_any",
    name: "No any type",
    description:
      "禁止使用 TypeScript any 类型。使用 unknown 替代并通过类型守卫缩小类型范围，确保类型安全。",
    category: "lint",
    severity: "error",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (/: any[\\s;,)<>]/.test(src)) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder", "project"],
    enabled: true,
    tags: ["typescript", "type-safety"],
  },

  // ── Security ──
  {
    id: "rule_no_eval",
    name: "No eval()",
    description:
      "禁止使用 eval() 或 new Function()，这是最常见的代码注入漏洞来源。使用 JSON.parse 或安全的替代方案。",
    category: "security",
    severity: "error",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx|js)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (/\\beval\\s*\\(/.test(src) || /new Function\\(/.test(src)) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder", "project"],
    enabled: true,
    tags: ["injection", "owasp"],
  },
  {
    id: "rule_no_hardcoded_secrets",
    name: "No hardcoded secrets",
    description:
      "禁止在源码中硬编码 API Key、密码、Token 等敏感信息。使用环境变量或 secret manager。",
    category: "security",
    severity: "error",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join, basename } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".env.example") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx|js|env)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const pattern = /(api_key|secret|password|token)\\s*[:=]\\s*['"][^'"]{4,}/i;
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (pattern.test(src)) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder", "project"],
    enabled: true,
    tags: ["secrets", "owasp"],
  },

  // ── Style ──
  {
    id: "rule_consistent_naming",
    name: "Consistent naming convention",
    description:
      "变量和函数使用 camelCase，组件和类使用 PascalCase，常量使用 UPPER_SNAKE_CASE，文件名与默认导出一致。",
    category: "style",
    severity: "info",
    checkScript: `import { readdir } from "fs/promises";
import { join, basename, extname } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const name = basename(f, extname(f));
    if (name === "index") continue;
    if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["folder", "project"],
    enabled: true,
    tags: ["naming", "convention"],
  },
  {
    id: "rule_max_file_length",
    name: "Max file length (300 lines)",
    description: "单文件不超过 300 行。超过后应拆分为更小的模块，每个模块职责单一。",
    category: "style",
    severity: "warning",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
const THRESHOLD = 300;
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    if (src.split("\\n").length > THRESHOLD) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["folder", "project"],
    enabled: true,
    tags: ["complexity", "readability"],
  },

  // ── Performance ──
  {
    id: "rule_no_n_plus_one",
    name: "No N+1 queries",
    description: "避免在循环中执行数据库查询（N+1 问题）。使用批量查询或 JOIN 替代逐条查询。",
    category: "performance",
    severity: "error",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(ts|tsx)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    const lines = src.split("\\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (/(for|forEach|map|filter|reduce)\\s*[\\(\\{]/.test(line)) {
        const ctx = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 5)).join(" ");
        if (/\\b(findOne|findFirst|findById|db\\.)/.test(ctx)) return false;
      }
    }
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder"],
    enabled: true,
    tags: ["database", "query"],
  },
  {
    id: "rule_lazy_load_images",
    name: "Lazy load images",
    description:
      '非首屏图片必须使用 loading="lazy" 或 Intersection Observer 延迟加载，减少初始加载时间。',
    category: "performance",
    severity: "info",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (/\\.(tsx|html)$/.test(e.name)) files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    const imgTags = src.match(/<img[^>]+>/g) ?? [];
    for (const tag of imgTags) {
      if (!tag.includes("loading=")) return false;
    }
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["file", "folder"],
    enabled: true,
    tags: ["frontend", "loading"],
  },

  // ── Custom ──
  {
    id: "rule_barrel_export_only",
    name: "Barrel export only re-exports",
    description: "index.ts 文件只允许 re-export，禁止包含业务逻辑、变量声明或副作用代码。",
    category: "custom",
    severity: "warning",
    checkScript: `import { readdir, readFile } from "fs/promises";
import { join } from "path";
interface RuleTarget { path: string; type: string }
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(full));
    else if (e.name === "index.ts" || e.name === "index.tsx") files.push(full);
  }
  return files;
}
export default async function check(target: RuleTarget): Promise<boolean> {
  const files = await walk(target.path);
  for (const f of files) {
    const src = await readFile(f, "utf8");
    const lines = src.split("\\n").filter(
      l => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")
    );
    const nonExport = lines.filter(l => !l.trim().startsWith("export"));
    if (nonExport.length > 0) return false;
  }
  return true;
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["folder", "project"],
    enabled: true,
    tags: ["barrel", "module"],
  },
];

// ─── Seed Runner ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding rules via REST API...\n");

  let upserted = 0;

  for (const rule of RULES) {
    await apiPut("/api/rules", rule);
    console.log(`  ✅  ${rule.id} — ${rule.name} — upserted`);
    upserted++;
  }

  console.log(`\n🎉 Done — ${upserted} rules upserted.`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
