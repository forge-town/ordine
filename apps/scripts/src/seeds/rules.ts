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

import { db, client, rulesTable, type NewRuleRow } from "../db.ts";
import { eq } from "drizzle-orm";

// ─── Rules Data ──────────────────────────────────────────────────────────────

const RULES: NewRuleRow[] = [
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  if (/\\bconsole\\.log\\(/.test(src)) hits.push(f);
}
if (hits.length > 0) {
  console.error("FAIL: console.log found in:\\n" + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
try {
  execSync(\`npx oxlint --deny no-unused-vars "\${inputPath}"\`, { stdio: "inherit" });
} catch {
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  if (/: any[\\s;,)<>]/.test(src)) hits.push(f);
}
if (hits.length > 0) {
  console.error("FAIL: \\"any\\" type found in:\\n" + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  if (/\\beval\\s*\\(/.test(src) || /new Function\\(/.test(src)) hits.push(f);
}
if (hits.length > 0) {
  console.error("FAIL: eval() or new Function() found in:\\n" + hits.join("\\n"));
  process.exit(1);
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
import { join } from "path";
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const pattern = /(api_key|secret|password|token)\\s*[:=]\\s*['"][^'"]{4,}/i;
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  if (pattern.test(src)) hits.push(f);
}
if (hits.length > 0) {
  console.error("FAIL: Potential hardcoded secrets in:\\n" + hits.join("\\n"));
  process.exit(1);
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
    checkScript: `import { readdir, stat } from "fs/promises";
import { join, basename, extname } from "path";
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const name = basename(f, extname(f));
  if (name === "index") continue;
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(name)) {
    hits.push(\`Invalid filename: \${f}\`);
  }
}
if (hits.length > 0) {
  console.error("FAIL: Naming issues:\\n" + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  const lines = src.split("\\n").length;
  if (lines > THRESHOLD) hits.push(\`\${f} (\${lines} lines)\`);
}
if (hits.length > 0) {
  console.error(\`FAIL: Files exceeding \${THRESHOLD} lines:\\n\` + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  const lines = src.split("\\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/(for|forEach|map|filter|reduce)\\s*[\\(\\{]/.test(line)) {
      const ctx = lines.slice(Math.max(0, i-1), Math.min(lines.length, i+5)).join(" ");
      if (/\\b(findOne|findFirst|findById|db\\.)/.test(ctx)) {
        hits.push(\`\${f}:\${i + 1}\`);
      }
    }
  }
}
if (hits.length > 0) {
  console.error("FAIL: Potential N+1 patterns at:\\n" + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  const imgTags = src.match(/<img[^>]+>/g) ?? [];
  for (const tag of imgTags) {
    if (!tag.includes("loading=")) hits.push(\`\${f}: \${tag.slice(0, 60)}\`);
  }
}
if (hits.length > 0) {
  console.error("FAIL: <img> without loading= found:\\n" + hits.join("\\n"));
  process.exit(1);
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
const inputPath = process.env["INPUT_PATH"] ?? ".";
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
const files = await walk(inputPath);
const hits: string[] = [];
for (const f of files) {
  const src = await readFile(f, "utf8");
  const lines = src.split("\\n").filter(l => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"));
  const nonExport = lines.filter(l => !l.trim().startsWith("export"));
  if (nonExport.length > 0) hits.push(\`\${f}: non-export lines: \${nonExport.length}\`);
}
if (hits.length > 0) {
  console.error("FAIL: index files with non-export statements:\\n" + hits.join("\\n"));
  process.exit(1);
}`,
    scriptLanguage: "typescript",
    acceptedObjectTypes: ["folder", "project"],
    enabled: true,
    tags: ["barrel", "module"],
  },
];

// ─── Seed Runner ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding rules...\n");

  let upserted = 0;

  for (const rule of RULES) {
    const existing = await db.select().from(rulesTable).where(eq(rulesTable.id, rule.id!)).limit(1);

    if (existing.length > 0) {
      await db
        .update(rulesTable)
        .set({
          name: rule.name,
          description: rule.description,
          category: rule.category,
          severity: rule.severity,
          checkScript: rule.checkScript,
          scriptLanguage: rule.scriptLanguage,
          acceptedObjectTypes: rule.acceptedObjectTypes,
          enabled: rule.enabled,
          tags: rule.tags,
          updatedAt: new Date(),
        })
        .where(eq(rulesTable.id, rule.id!));
      console.log(`  ✏️  Updated: ${rule.id} — ${rule.name}`);
    } else {
      await db.insert(rulesTable).values(rule);
      console.log(`  ✅ Created: ${rule.id} — ${rule.name}`);
    }
    upserted++;
  }

  console.log(`\n🎉 Done — ${upserted} rules upserted.`);
  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
