/**
 * Seed: Skill → Pipeline Conversions
 *
 * Converts 3 agent skills into Ordine pipelines:
 *   1. clean-hardcode  → "代码清理" pipeline
 *   2. refactor-classname → "ClassName 规范化" pipeline
 *   3. check-all-best-practices → "全量最佳实践检查" pipeline
 *
 * Each pipeline consists of:
 *   - Input node (folder/project)
 *   - 2 operation nodes (agent-based)
 *   - Output node (report)
 */

import { apiPut } from "../api";

// ─── Config Helpers ──────────────────────────────────────────────────────────

interface InputPort {
  name: string;
  kind: "text" | "file" | "folder" | "project";
  required: boolean;
  description: string;
}

interface OutputPort {
  name: string;
  kind: "text" | "file" | "folder" | "project";
  path: string;
  description: string;
}

interface OperationConfig {
  executor: {
    type: "agent" | "skill" | "prompt" | "script";
    agentMode?: "skill" | "prompt";
    prompt?: string;
    skillId?: string;
    command?: string;
    language?: string;
    writeEnabled?: boolean;
  };
  inputs: InputPort[];
  outputs: OutputPort[];
}

function cfg(config: OperationConfig): string {
  return JSON.stringify(config);
}

// ─── Operations ──────────────────────────────────────────────────────────────

interface OperationSeed {
  id: string;
  name: string;
  description: string;
  acceptedObjectTypes?: string[];
  config: string;
}

interface PipelineSeed {
  id: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  tags?: string[];
}

const OPERATIONS: OperationSeed[] = [
  // ── clean-hardcode: Op 1 — 扫描垃圾代码 ─────────────────────────────────
  {
    id: "op_scan_junk_code",
    name: "扫描垃圾代码",
    description:
      "扫描目标代码，按检查清单逐项检查（未使用导入、console.log、注释代码段、死代码、空函数、重复导入、调试断点），输出违规清单。",
    acceptedObjectTypes: ["file", "folder", "project"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个代码清理扫描器。按照以下检查清单逐项扫描输入代码：

## 检查项
1. **未使用的导入**: 文件中 import 但从未使用的模块
2. **重复导入**: 同一模块被 import 多次
3. **console 语句**: console.log/warn/error/debug 调试输出（带 "intentional" 注释的除外）
4. **调试断点**: debugger 语句
5. **临时代码**: TODO: remove / TEMP / HACK 标记的代码块
6. **注释掉的代码**: 被注释掉的功能代码段（决策说明注释除外）
7. **未调用的函数**: 从未被调用也未被导出的函数/方法
8. **永不执行的分支**: return 之后的代码、if(false) 等
9. **空函数**: 函数体为空且无说明注释的函数

## 输出格式
输出 Markdown 格式的违规清单：
- 文件路径
- 行号
- 违规类型
- 代码片段
- 建议操作（删除/合并/添加注释）

只报告确认无用的代码。若不确定，标记为"待确认"。`,
      },
      inputs: [
        {
          name: "sourceCode",
          kind: "folder",
          required: true,
          description: "要扫描的源代码目录",
        },
      ],
      outputs: [
        {
          name: "violationReport",
          kind: "file",
          path: "junk-code-report.md",
          description: "垃圾代码违规清单",
        },
      ],
    }),
  },

  // ── clean-hardcode: Op 2 — 执行清理 ─────────────────────────────────────
  {
    id: "op_clean_junk_code",
    name: "清理垃圾代码",
    description: "根据违规清单执行代码清理，删除确认无用的代码，输出清理报告和修改后的文件列表。",
    acceptedObjectTypes: ["file", "folder", "project"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个代码清理执行器。根据输入的违规清单，执行以下清理操作：

## 清理规则
1. **删除未使用的导入** — 直接移除
2. **合并重复导入** — 合并为一条 import 语句
3. **删除 console 语句** — 移除调试输出（保留标记为 intentional 的）
4. **删除 debugger** — 直接移除
5. **删除注释代码** — 移除被注释掉的功能代码段
6. **删除死代码** — 移除未调用函数、永不执行的分支、空函数

## 安全原则
- 只删除违规清单中标记为"确认删除"的项目
- "待确认"的项目保持不变
- 清理后确保代码仍可编译

## 输出格式
输出 Markdown 清理报告：
- 总计清理项数
- 每项：文件路径 + 行号 + 操作（删除/合并）+ 原始代码
- 是否存在需要人工确认的项目`,
      },
      inputs: [
        {
          name: "violationReport",
          kind: "text",
          required: true,
          description: "上一步生成的违规清单",
        },
        {
          name: "sourceCode",
          kind: "folder",
          required: true,
          description: "要清理的源代码目录",
        },
      ],
      outputs: [
        {
          name: "cleanupReport",
          kind: "file",
          path: "cleanup-report.md",
          description: "清理执行报告",
        },
      ],
    }),
  },

  // ── refactor-classname: Op 1 — 扫描 className 违规 ──────────────────────
  {
    id: "op_scan_classname",
    name: "扫描 className 违规",
    description:
      "递归扫描文件夹内所有 TSX/JSX 文件，找出使用模板字符串的 className 属性，输出违规位置列表。",
    acceptedObjectTypes: ["file", "folder"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个 className 规范扫描器。扫描输入的 React/Vue 文件，找出所有使用模板字符串的 className 属性。

## 需要标记的模式
1. \`className={\`...\`}\` — 模板字符串形式的 className
2. \`className={\`static \${dynamic}\`}\` — 带插值的模板字符串
3. \`className={\`\${cond ? 'a' : 'b'}\`}\` — 带条件表达式的模板字符串

## 不标记的模式（合规）
- \`className="static-string"\` — 纯静态字符串
- \`className={cn("a", "b")}\` — 已使用 cn() 函数
- \`className={variable}\` — 直接变量引用

## 输出格式
Markdown 表格：
| 文件路径 | 行号 | 当前代码 | 建议转换 |

转换规则：
- \`\`\`className={\\\`flex \${condition}\\\`}\`\`\` → \`className={cn("flex", condition)}\`
- \`\`\`className={\\\`\${a} \${b}\\\`}\`\`\` → \`className={cn(a, b)}\`
- \`\`\`className={\\\`base \${x ? 'y' : ''}\\\`}\`\`\` → \`className={cn("base", x ? "y" : "")}\``,
      },
      inputs: [
        {
          name: "sourceFiles",
          kind: "folder",
          required: true,
          description: "要扫描的源文件目录（TSX/JSX）",
        },
      ],
      outputs: [
        {
          name: "classNameReport",
          kind: "file",
          path: "classname-violations.md",
          description: "className 违规位置及建议转换列表",
        },
      ],
    }),
  },

  // ── refactor-classname: Op 2 — 执行转换 ─────────────────────────────────
  {
    id: "op_refactor_classname",
    name: "转换 className 为 cn()",
    description:
      "按转换规则将模板字符串 className 转为 cn() 调用，确保文件顶部已导入 cn，输出转换报告。",
    acceptedObjectTypes: ["file", "folder"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个 className 重构执行器。根据输入的违规列表，将所有模板字符串 className 转换为 cn() 函数调用。

## 转换规则
1. 静态: \`className={\\\`flex gap-4\\\`}\` → \`className={cn("flex gap-4")}\`
2. 动态变量: \`className={\\\`\${myClass}\\\`}\` → \`className={cn(myClass)}\`
3. 静态+动态: \`className={\\\`base \${dynamic}\\\`}\` → \`className={cn("base", dynamic)}\`
4. 条件: \`className={\\\`base \${isActive ? 'active' : ''}\\\`}\` → \`className={cn("base", isActive ? "active" : "")}\`
5. 多变量: \`className={\\\`base \${a} \${b}\\\`}\` → \`className={cn("base", a, b)}\`

## 导入检查
转换后检查文件是否已导入 cn：
- 如未导入，在文件顶部添加: \`import { cn } from "@repo/ui/lib/utils";\`

## 输出格式
Markdown 转换报告：
- 总计转换文件数 / 转换项数
- 每项：文件路径 + 行号 + 原始代码 → 转换后代码
- 新增导入的文件列表`,
      },
      inputs: [
        {
          name: "classNameReport",
          kind: "text",
          required: true,
          description: "上一步生成的违规列表",
        },
        {
          name: "sourceFiles",
          kind: "folder",
          required: true,
          description: "要重构的源文件目录",
        },
      ],
      outputs: [
        {
          name: "refactorReport",
          kind: "file",
          path: "classname-refactor-report.md",
          description: "className 转换报告",
        },
      ],
    }),
  },

  // ── refactor-classname: Op 3 — 实现修复 ─────────────────────────────────
  {
    id: "op_implement_classname",
    name: "实现 className 修复",
    description:
      "根据扫描报告，使用 Claude CLI 实际修改代码：将模板字符串 className 转为 cn() 调用，并确保导入 cn。",
    acceptedObjectTypes: ["file", "folder"],
    config: cfg({
      executor: {
        type: "skill",
        skillId: "sk_check_classname",
        writeEnabled: true,
      },
      inputs: [
        {
          name: "checkReport",
          kind: "text",
          required: true,
          description: "上一步扫描生成的 className 违规报告",
        },
      ],
      outputs: [
        {
          name: "implementReport",
          kind: "file",
          path: "classname-implement-report.md",
          description: "className 实现（修复）报告",
        },
      ],
    }),
  },

  // ── check-all-best-practices: Op 1 — 发现 best-practice 技能 ────────────
  {
    id: "op_discover_best_practices",
    name: "发现最佳实践技能",
    description:
      "扫描技能库（.agents/skills 目录），列出所有以 best-practice 结尾的技能名称和描述。",
    acceptedObjectTypes: ["project"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个技能库扫描器。扫描项目的 .agents/skills/ 目录，找出所有以 "best-practice" 结尾的技能文件夹。

## 扫描步骤
1. 列出 .agents/skills/ 下所有目录
2. 筛选名称以 "-best-practice" 结尾的目录
3. 读取每个目录下的 SKILL.md 文件
4. 提取技能名称和 description 字段

## 输出格式
Markdown 列表：
| 序号 | 技能名称 | 描述 | SKILL.md 路径 |

按字母顺序排列。`,
      },
      inputs: [
        {
          name: "projectRoot",
          kind: "project",
          required: true,
          description: "项目根目录",
        },
      ],
      outputs: [
        {
          name: "skillList",
          kind: "file",
          path: "best-practice-skills.md",
          description: "发现的 best-practice 技能列表",
        },
      ],
    }),
  },

  // ── check-all-best-practices: Op 2 — 执行检查 ───────────────────────────
  {
    id: "op_run_best_practice_checks",
    name: "执行最佳实践检查",
    description: "按技能列表依次对项目执行每个 best-practice 检查，生成汇总报告。",
    acceptedObjectTypes: ["project"],
    config: cfg({
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: `你是一个代码质量检查器。根据输入的 best-practice 技能列表，对项目代码依次执行检查。

## 执行流程
对每个 best-practice 技能：
1. 读取对应的 SKILL.md 获取检查规则
2. 如有 references/checklist.md，按清单逐项检查
3. 扫描项目代码，找出违反该规范的位置
4. 记录违规详情

## 检查维度（按技能自动发现）
常见维度包括但不限于：
- DAO 规范 (dao-best-practice)
- Service 规范 (service-best-practice)  
- Store 规范 (store-best-practice)
- 组件设计规范 (component-design-best-practice)
- 错误处理规范 (error-handling-best-practice)
- Schema 规范 (schema-best-practice)
- 等等...

## 输出格式
Markdown 汇总报告：

### 总体评分
- 通过: X / Y 项
- 违规: Z 项

### 各维度详情
每个维度包含：
- 状态: ✅ 通过 / ❌ 违规
- 违规数量
- 违规详情（文件路径 + 行号 + 说明）
- 修复建议`,
      },
      inputs: [
        {
          name: "skillList",
          kind: "text",
          required: true,
          description: "上一步发现的 best-practice 技能列表",
        },
        {
          name: "projectRoot",
          kind: "project",
          required: true,
          description: "要检查的项目",
        },
      ],
      outputs: [
        {
          name: "qualityReport",
          kind: "file",
          path: "best-practices-report.md",
          description: "全量最佳实践检查报告",
        },
      ],
    }),
  },
];

// ─── Pipelines ───────────────────────────────────────────────────────────────

const PIPELINES: PipelineSeed[] = [
  // ── Pipeline 1: 代码清理 ────────────────────────────────────────────────
  {
    id: "pl_clean_hardcode",
    name: "代码清理",
    description:
      "扫描并清理代码库中的垃圾代码：未使用导入、console.log、注释代码段、死代码、空函数等。",
    tags: ["clean", "quality"],
    nodes: [
      {
        id: "n_ch_input",
        type: "folder",
        metaType: "object",
        position: { x: 100, y: 200 },
        data: {
          label: "源代码目录",
          nodeType: "folder",
          folderPath: "",
          description: "要清理的源代码文件夹",
        },
      },
      {
        id: "n_ch_scan",
        type: "operation",
        metaType: "operation",
        position: { x: 400, y: 200 },
        data: {
          label: "扫描垃圾代码",
          nodeType: "operation",
          operationId: "op_scan_junk_code",
          operationName: "扫描垃圾代码",
          status: "idle",
        },
      },
      {
        id: "n_ch_clean",
        type: "operation",
        metaType: "operation",
        position: { x: 700, y: 200 },
        data: {
          label: "清理垃圾代码",
          nodeType: "operation",
          operationId: "op_clean_junk_code",
          operationName: "清理垃圾代码",
          status: "idle",
        },
      },
      {
        id: "n_ch_output",
        type: "output-local-path",
        metaType: "output",
        position: { x: 1000, y: 200 },
        data: {
          label: "清理报告",
          nodeType: "output-local-path",
          path: "",
          description: "清理执行报告输出路径",
          outputMode: "overwrite",
        },
      },
    ],
    edges: [
      {
        id: "e_ch_1",
        source: "n_ch_input",
        target: "n_ch_scan",
      },
      {
        id: "e_ch_2",
        source: "n_ch_scan",
        target: "n_ch_clean",
      },
      {
        id: "e_ch_3",
        source: "n_ch_clean",
        target: "n_ch_output",
      },
    ],
  },

  // ── Pipeline 2: ClassName 规范化 ────────────────────────────────────────
  {
    id: "pl_refactor_classname",
    name: "ClassName 规范化",
    description: "扫描 React/Vue 文件中的 className 模板字符串并转换为 cn() 函数调用。",
    tags: ["refactor", "react", "className"],
    nodes: [
      {
        id: "n_cn_input",
        type: "folder",
        metaType: "object",
        position: { x: 100, y: 200 },
        data: {
          label: "源文件目录",
          nodeType: "folder",
          folderPath: "",
          description: "包含 TSX/JSX 文件的源文件夹",
        },
      },
      {
        id: "n_cn_scan",
        type: "operation",
        metaType: "operation",
        position: { x: 400, y: 200 },
        data: {
          label: "扫描 className 违规",
          nodeType: "operation",
          operationId: "op_scan_classname",
          operationName: "扫描 className 违规",
          status: "idle",
        },
      },
      {
        id: "n_cn_implement",
        type: "operation",
        metaType: "operation",
        position: { x: 700, y: 200 },
        data: {
          label: "实现 className 修复",
          nodeType: "operation",
          operationId: "op_implement_classname",
          operationName: "实现 className 修复",
          status: "idle",
        },
      },
      {
        id: "n_cn_output",
        type: "output-local-path",
        metaType: "output",
        position: { x: 1000, y: 200 },
        data: {
          label: "转换报告",
          nodeType: "output-local-path",
          path: "",
          description: "className 转换报告输出路径",
          outputMode: "overwrite",
        },
      },
    ],
    edges: [
      {
        id: "e_cn_1",
        source: "n_cn_input",
        target: "n_cn_scan",
      },
      {
        id: "e_cn_2",
        source: "n_cn_scan",
        target: "n_cn_implement",
      },
      {
        id: "e_cn_3",
        source: "n_cn_implement",
        target: "n_cn_output",
      },
    ],
  },

  // ── Pipeline 3: 全量最佳实践检查 ────────────────────────────────────────
  {
    id: "pl_check_best_practices",
    name: "全量最佳实践检查",
    description: "自动发现所有 best-practice 技能并依次对项目执行检查，输出汇总质量报告。",
    tags: ["check", "quality", "best-practice"],
    nodes: [
      {
        id: "n_bp_input",
        type: "github-project",
        metaType: "object",
        position: { x: 100, y: 200 },
        data: {
          label: "项目",
          nodeType: "github-project",
          description: "要检查的项目",
        },
      },
      {
        id: "n_bp_discover",
        type: "operation",
        metaType: "operation",
        position: { x: 400, y: 200 },
        data: {
          label: "发现最佳实践技能",
          nodeType: "operation",
          operationId: "op_discover_best_practices",
          operationName: "发现最佳实践技能",
          status: "idle",
        },
      },
      {
        id: "n_bp_check",
        type: "operation",
        metaType: "operation",
        position: { x: 700, y: 200 },
        data: {
          label: "执行最佳实践检查",
          nodeType: "operation",
          operationId: "op_run_best_practice_checks",
          operationName: "执行最佳实践检查",
          status: "idle",
        },
      },
      {
        id: "n_bp_output",
        type: "output-local-path",
        metaType: "output",
        position: { x: 1000, y: 200 },
        data: {
          label: "质量报告",
          nodeType: "output-local-path",
          path: "",
          description: "全量最佳实践检查报告输出路径",
          outputMode: "overwrite",
        },
      },
    ],
    edges: [
      {
        id: "e_bp_1",
        source: "n_bp_input",
        target: "n_bp_discover",
      },
      {
        id: "e_bp_2",
        source: "n_bp_discover",
        target: "n_bp_check",
      },
      {
        id: "e_bp_3",
        source: "n_bp_check",
        target: "n_bp_output",
      },
    ],
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱  Seeding skill-based operations & pipelines via REST API...\n");

  // ── Seed Operations ──
  let opsUpserted = 0;

  for (const op of OPERATIONS) {
    await apiPut("/api/operations", op);
    console.log(`  ✅  Op: ${op.name} (${op.id}) — upserted`);
    opsUpserted++;
  }

  console.log(`\n  Operations — Upserted: ${opsUpserted}\n`);

  // ── Seed Pipelines ──
  let plUpserted = 0;

  for (const pl of PIPELINES) {
    await apiPut("/api/pipelines", pl);
    console.log(`  ✅  Pipeline: ${pl.name} (${pl.id}) — upserted`);
    plUpserted++;
  }

  console.log(`\n  Pipelines — Upserted: ${plUpserted}`);
  console.log(`\n✨  Done. ${opsUpserted + plUpserted} records upserted.`);
}

seed().catch((error) => {
  console.error("❌  Seed failed:", error);
  process.exit(1);
});
