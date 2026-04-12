/**
 * Seed: Rules
 *
 * Seeds basic code quality rules across categories:
 *   - lint: no-console-log, no-unused-imports, no-any
 *   - security: no-eval, no-hardcoded-secrets
 *   - style: consistent-naming, max-file-length
 *   - performance: no-n-plus-one, lazy-load-images
 *   - custom: barrel-export-only
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
    pattern: "console\\.log\\(",
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
    pattern: null,
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
    pattern: ": any[\\s;,)]",
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
    pattern: "\\beval\\s*\\(",
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
    pattern: "(api_key|secret|password|token)\\s*[:=]\\s*['\"]",
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
    pattern: null,
    enabled: true,
    tags: ["naming", "convention"],
  },
  {
    id: "rule_max_file_length",
    name: "Max file length (300 lines)",
    description: "单文件不超过 300 行。超过后应拆分为更小的模块，每个模块职责单一。",
    category: "style",
    severity: "warning",
    pattern: null,
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
    pattern: null,
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
    pattern: null,
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
    pattern: null,
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
          pattern: rule.pattern,
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
