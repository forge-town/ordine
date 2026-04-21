/**
 * Seed: Recipes
 *
 * Creates recipes that bind operations (verbs) to best practices (standards):
 *   1. Check 代码清理 → op_check + bp_clean_hardcode
 *   2. Check ClassName → op_check + bp_classname_convention
 *   3. 扫描垃圾代码 (w/ 代码清理规范) → op_scan_junk_code + bp_clean_hardcode
 *   4. 扫描 className (w/ 转换规则) → op_scan_classname + bp_classname_convention
 *   5. Check 全量最佳实践 → op_check + bp_full_check_workflow
 */

import { apiPut } from "../api";

interface RecipeSeed {
  id: string;
  name: string;
  description: string;
  operationId: string;
  bestPracticeId: string;
}

const RECIPES: RecipeSeed[] = [
  {
    id: "rcp_check_clean_code",
    name: "Check 代码清理",
    description: "使用 Check 动词检查代码是否符合代码清理规范",
    operationId: "op_check",
    bestPracticeId: "bp_clean_hardcode",
  },
  {
    id: "rcp_check_classname",
    name: "Check ClassName",
    description: "使用 Check 动词检查 className 是否符合 cn() 转换规则",
    operationId: "op_check",
    bestPracticeId: "bp_classname_convention",
  },
  {
    id: "rcp_scan_junk_code",
    name: "扫描垃圾代码",
    description: "使用扫描操作配合代码清理规范发现代码中的垃圾代码",
    operationId: "op_scan_junk_code",
    bestPracticeId: "bp_clean_hardcode",
  },
  {
    id: "rcp_scan_classname",
    name: "扫描 ClassName 违规",
    description: "使用扫描操作配合 ClassName 转换规则发现不规范的 className",
    operationId: "op_scan_classname",
    bestPracticeId: "bp_classname_convention",
  },
  {
    id: "rcp_check_all_practices",
    name: "Check 全量最佳实践",
    description: "使用 Check 动词执行全量最佳实践检查流程",
    operationId: "op_check",
    bestPracticeId: "bp_full_check_workflow",
  },
];

async function seed() {
  console.log("🌱 Seeding recipes via REST API...\n");

  let upserted = 0;

  for (const recipe of RECIPES) {
    await apiPut("/api/recipes", recipe);
    console.log(`  ✅  ${recipe.id} — ${recipe.name} — upserted`);
    upserted++;
  }

  console.log(`\n🎉 Done — ${upserted} recipes upserted.`);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
