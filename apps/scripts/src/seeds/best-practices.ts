/**
 * Seed: Best Practices
 *
 * Seeds 3 best practices derived from agent skills:
 *   1. clean-hardcode → 代码清理规范
 *   2. refactor-classname → ClassName 转换规则
 *   3. check-all-best-practices → 全量最佳实践检查流程
 */

import {
  db,
  client,
  bestPracticesTable,
  type NewBestPracticeRow,
} from "../db.ts";
import { eq } from "drizzle-orm";

// ─── Best Practice Data ──────────────────────────────────────────────────────

const BEST_PRACTICES: NewBestPracticeRow[] = [
  {
    id: "bp_clean_hardcode",
    title: "代码清理规范",
    condition:
      "需要清理代码库中的垃圾代码，包括未使用导入、注释代码段、console.log、死代码、空函数、重复代码等",
    content: `# 代码清理检查清单

执行规则：**逐项扫描，发现后立即清理，不得保留"以防万一"的无用代码。**

---

## 一、导入清理

### 1.1 未使用的导入
- 已删除所有未在文件中实际使用的 \`import\` 语句
  - Bad：\`import { useState } from 'react'\` — 文件中没有用到 \`useState\`
  - Bad：\`import type { Foo } from './foo'\` — \`Foo\` 类型未被引用

### 1.2 重复导入
- 同一模块不存在多条 \`import\` 语句（应合并为一条）
  - Bad：\`import { A } from './x'\` 和 \`import { B } from './x'\` 各自独立

---

## 二、调试代码

### 2.1 console 语句
- 已删除所有 \`console.log\`、\`console.warn\`、\`console.error\`、\`console.debug\` 调试输出
  - 例外：有意保留的生产日志须带注释说明（如 \`// intentional: track payment flow\`）

### 2.2 调试断点与临时代码
- 已删除 \`debugger\` 语句
- 已删除形如 \`// TODO: remove this\`、\`// TEMP\`、\`// HACK\` 的临时代码块

---

## 三、注释代码

### 3.1 注释掉的代码块
- 已删除所有被注释掉的代码段（保留在版本控制历史中即可）
  - Bad：大段 \`// const oldHandler = ...\` 注释
  - 例外：注释用于说明**为何不这样做**的决策记录可保留

---

## 四、死代码

### 4.1 未被调用的函数/方法
- 已确认并删除从未被调用、也未被导出的函数或方法

### 4.2 永不执行的分支
- 已删除永远无法到达的代码路径
  - Bad：\`return result\` 之后仍有代码 / \`if (false) { ... }\`

### 4.3 空函数与空块
- 不存在函数体为空且无说明注释的函数
  - Bad：\`function onSuccess() {}\` — 若是占位须加 \`// TODO\` 注释

---

## 五、清理结果汇总

- 已列出所有清理项（文件路径 + 行号 + 清理内容描述）
- 清理后代码可正常编译/通过类型检查，无引入新错误`,
    category: "general",
    language: "typescript",
    codeSnippet: `// Bad: unused import
import { useState } from 'react';

// Bad: console.log left in code
console.log('debug:', data);

// Bad: commented out code block
// const oldHandler = () => {
//   doSomething();
// };

// Bad: dead code after return
function getData() {
  return result;
  cleanup(); // never executed
}`,
    tags: ["clean-code", "lint", "dead-code", "imports"],
  },
  {
    id: "bp_classname_convention",
    title: "ClassName 转换规则",
    condition:
      "需要检查或转换 React/Vue 文件中 className 的模板字符串为 cn 函数调用",
    content: `# ClassName 转换规则

## 核心原则

**所有模板字符串形式的 className 必须转换为调用 cn 函数**

- 错误：\`className={\\\`flex \${condition}\\\`}\`
- 正确：\`className={cn("flex", condition)}\`

## cn 函数导入

标准导入路径为 \`@/lib/utils\`：

\`\`\`tsx
import { cn } from "@/lib/utils";
\`\`\`

## 转换规则

### 规则 1：静态类名
\`\`\`tsx
className={\\\`flex gap-4\\\`}
→ className={cn("flex gap-4")}
\`\`\`

### 规则 2：动态变量
\`\`\`tsx
className={\\\`\${myClass}\\\`}
→ className={cn(myClass)}
\`\`\`

### 规则 3：静态 + 动态
\`\`\`tsx
className={\\\`base \${dynamic}\\\`}
→ className={cn("base", dynamic)}
\`\`\`

### 规则 4：条件表达式
\`\`\`tsx
className={\\\`base \${isActive ? 'active' : ''}\\\`}
→ className={cn("base", isActive ? "active" : "")}
\`\`\`

### 规则 5：多个变量/条件
\`\`\`tsx
className={\\\`base \${a} \${b} \${cond ? 'x' : ''}\\\`}
→ className={cn("base", a, b, cond ? "x" : "")}
\`\`\`

### 规则 6：多行模板
\`\`\`tsx
className={\\\`
  flex
  \${condition}
  gap-4
\\\`}
→ className={cn("flex", condition, "gap-4")}
\`\`\`

## 不转换的场景

- 纯静态字符串：\`className="flex"\`（不需要 cn 函数）
- 已调用 cn 函数：\`className={cn("flex", condition)}\`（已经正确）
- 函数调用：\`className={getClass()}\`（不是 className 属性问题）
- 非 className 属性：\`style={\\\`color: \${color}\\\`}\`（不处理）

## 注意事项

1. **必须调用 cn 函数**：所有模板字符串形式的 className 必须转换为调用 cn 函数
2. **必须导入 cn 函数**：确保文件顶部有正确的导入语句
3. **清理空格**：转换时合并多个空格为一个
4. **保留逻辑**：条件表达式和变量引用完全保留
5. **测试验证**：转换后必须进行 UI 测试`,
    category: "component",
    language: "tsx",
    codeSnippet: `// Bad: template string className
<div className={\`flex gap-3 \${isActive ? "active" : ""}\`}>

// Good: cn function call
<div className={cn("flex gap-3", isActive ? "active" : "")}>

// Bad: missing cn import
// Good: import { cn } from "@/lib/utils";`,
    tags: ["classname", "cn", "tailwind", "react"],
  },
  {
    id: "bp_full_check_workflow",
    title: "全量最佳实践检查流程",
    condition:
      "需要对项目进行全量最佳实践检查，自动发现并依次执行所有以 best-practice 结尾的技能",
    content: `# 全量最佳实践检查流程

## 执行流程

1. **自动发现**：扫描技能库，发现所有以 \`best-practice\` 结尾的技能
2. **依次执行**：对目标项目依次执行每个 best-practice 技能的检查
3. **汇总报告**：完成后输出汇总报告

## 完成清单

- 所有以 \`best-practice\` 结尾的技能已自动发现并依次执行
- 每个技能的检查结果已记录（pass / warning / error）
- 生成了汇总报告（包含技能名、问题描述、修复建议）
- 标准化验证指令已执行
- 未发现 error 级别问题；或 error 问题已修复并重新验证

## After Hook 验证机制

检查完成后强制执行验证：

### 默认验证命令
\`\`\`bash
npm run quality
\`\`\`

### 验证内容
- **质量检查**：代码质量、类型检查、格式化
- **测试执行**：单元测试、集成测试
- **静态分析**：ESLint、TypeScript 编译

### 结果处理
- **成功**：继续后续流程
- **失败**：记录详细错误信息，阻断后续流程
- **超时**：终止执行，标记为失败

### 成功报告示例
\`\`\`
✅ 验证通过
执行时间: 45秒
检查项目: 代码质量, 类型检查, 单元测试
\`\`\`

### 失败报告示例
\`\`\`
❌ 验证失败
错误详情:
- ESLint: 发现3个错误
- TypeScript: 编译失败
- 测试: 2个测试用例失败

修复建议:
1. 运行 lint:fix 自动修复ESLint错误
2. 检查类型错误并修复
3. 运行 test 查看详细测试结果
\`\`\``,
    category: "general",
    language: "typescript",
    codeSnippet: "",
    tags: ["quality", "lint", "testing", "automation"],
  },
];

// ─── Seed Runner ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding best practices...\n");

  let upserted = 0;

  for (const bp of BEST_PRACTICES) {
    const existing = await db
      .select()
      .from(bestPracticesTable)
      .where(eq(bestPracticesTable.id, bp.id!))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(bestPracticesTable)
        .set({
          title: bp.title,
          condition: bp.condition,
          content: bp.content,
          category: bp.category,
          language: bp.language,
          codeSnippet: bp.codeSnippet,
          tags: bp.tags,
          updatedAt: new Date(),
        })
        .where(eq(bestPracticesTable.id, bp.id!));
      console.log(`  ✏️  Updated: ${bp.id} — ${bp.title}`);
    } else {
      await db.insert(bestPracticesTable).values(bp);
      console.log(`  ✅ Created: ${bp.id} — ${bp.title}`);
    }
    upserted++;
  }

  console.log(`\n🎉 Done — ${upserted} best practices upserted.`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  client.end();
  process.exit(1);
});
