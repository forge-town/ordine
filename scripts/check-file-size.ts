#!/usr/bin/env tsx
/**
 * 单文件行数红线守护（H3-01）。
 *
 * 规则：非生成、非 vendored、非数据种子的源文件
 *   - >300 行：警告（不失败），提示拆分。
 *   - >400 行：失败——除非在 DEBT_ALLOWLIST（既有债务，只减不增）。
 *
 * DEBT_ALLOWLIST 是还债清单不是豁免特权：每拆掉一个就从清单删一行；新文件不得加入。
 *
 * Usage: node --experimental-strip-types scripts/check-file-size.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const SCAN_DIRS = ["apps", "packages"];
const WARN = 300;
const FAIL = 400;

const IGNORE_DIRS = new Set(["node_modules", "archived", "dist", ".turbo", "storybook-static"]);
const IGNORE_FILE_RE = /\.test\.|\.spec\.|\.stories\.|\.d\.ts$|\.gen\.ts$/;
/** 永久豁免：vendored 第三方与纯数据种子（非业务逻辑）。 */
const EXEMPT_RE = /packages\/ui\/src\/sidebar\.tsx$|apps\/scripts\/src\/seeds\//;

/** 既有 >400 行债务，只减不增（H3-01）。拆分后从此删除对应行。 */
const DEBT_ALLOWLIST = new Set<string>([
  "apps/app/src/pages/OperationEditPage/OperationEditPageContent/OperationEditForm.tsx",
  "apps/app/src/integrations/refine/dataProvider.ts",
  "packages/pipeline-engine/src/pipeline/Pipeline.ts",
  "apps/app/src/pages/OperationCreatePage/OperationCreatePageContent/OperationCreatePageContent.tsx",
  "apps/app/src/pages/PipelineDetailPage/PipelineDetailPageContent/PipelineDetailPageContent.tsx",
  "apps/app/src/components/SkillToOperationDialog/SkillToOperationDialog.tsx",
  "packages/services/src/pipelinesService/createPipelinesService.ts",
  "apps/app/src/pages/SkillsPage/SkillsPageContent/SkillsPageContent.tsx",
  "apps/cli/src/commands.ts",
  "apps/app/src/pages/WorkspacePage/canvas/_store/graphSlice.ts",
]);

const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || IGNORE_FILE_RE.test(entry)) continue;
    files.push(full);
  }
};

for (const dir of SCAN_DIRS) walk(join(ROOT, dir));

const warnings: string[] = [];
const failures: string[] = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  if (EXEMPT_RE.test(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines > FAIL && !DEBT_ALLOWLIST.has(rel)) {
    failures.push(`  ✗ ${rel}: ${lines} 行 (>${FAIL} 红线，且不在债务清单)`);
  } else if (lines > WARN && lines <= FAIL) {
    warnings.push(`  · ${rel}: ${lines} 行 (>${WARN}，建议拆分)`);
  }
}

if (warnings.length > 0) {
  console.warn(`\n[check-file-size] ${warnings.length} 个文件超过 ${WARN} 行（警告）：`);
  console.warn(warnings.join("\n"));
}

if (failures.length > 0) {
  console.error(`\n[check-file-size] ${failures.length} 个新文件突破 ${FAIL} 行红线：`);
  console.error(failures.join("\n"));
  console.error("\n拆分到红线以下，或（仅限确有理由）显式加入豁免/债务清单。\n");
  process.exit(1);
}

console.log(`[check-file-size] OK — 无新增超 ${FAIL} 行文件（${warnings.length} 个警告）。`);
