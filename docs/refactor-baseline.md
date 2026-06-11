# 质量基线记录（M0-03）

> 记录 M0-02 后仍存在的质量门失败项。这些不属于后续重构任务的回归，但后续任务**不允许新增失败**。修复它们可作为独立的 fix commit。

## 已存在的测试失败

| 包                         | 测试                                                                                                  | 现象                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/pipeline-engine` | `src/engine/engine.test.ts > operation node > skips operation when operationId is not found`          | 期望 `result.ok === true`（跳过），实际引擎对 operation 缺失返回 `ok:false`（OperationNode.ts 对 not found 返回 ScriptExecutionError）。测试语义与实现不一致，基线即失败 |
| `packages/pipeline-engine` | `src/engine/engine.test.ts > inputPath support > reads initial input file when inputPath is provided` | 同样 `result.ok === false`，基线即失败                                                                                                                                   |

验证方式：在 `refactor/ordinctor-m1` 的 M0-02 提交后运行 `bun run quality`，全量 `check-types` 通过，质量门最终停在上述两个既有测试失败（2026-06-10 验证）。

M1-10 收尾复核（2026-06-10）：

- `bun run format` 可执行，但会重排 213 个既有文件（包含历史快照、生成路由、文档和无关包源码），本轮未纳入提交，避免把全仓格式化噪音混入 M1。
- `bun run quality` 仍只阻塞在上表两条 `packages/pipeline-engine` 既有测试失败，未观察到 M1 新增失败。
- M1 新增迁移 `0027`-`0029` 在模拟 0026 后旧库上可增量执行，保留旧数据时默认值符合预期；带 `_ordine_migrations` 记录重复启动时无待执行迁移。
- 空 PGlite 目录全量执行历史迁移仍会在 `0002_add_accepted_object_types.sql` 失败，因为旧迁移链在此处修改 `operations` 表，但现有迁移文件未先创建该表；该问题早于 M1 新增迁移。

## 已知本地环境问题（不计入质量门新增失败）

1. Nitro 全量 build 在原作者本地环境失败（Node 内置 `https` 解析问题），与本重构无关。
2. Playwright E2E 在本地 `/login` networkidle 前超时（已知问题）。

## 非阻塞 lint warning

`bun run quality` 当前还会打印少量 oxlint warning，但不会导致命令失败。后续任务不得新增 warning。
ORDINE_LOCAL_MODE=true bun run dev
## Canvas V2 N0 基线（2026-06-11 11:15 CST）

本轮从 `refactor/ordinctor-m1` 切出 `refactor/canvas-v2`，按 Canvas V2 施工手册进入新画布重写阶段。

### 质量门现状

运行 `bun run quality` 时质量门提前停在 `@repo/pipeline-engine#quality` 的 oxlint：

| 包                         | 文件                                              | 现象                                                                              |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ----------- |
| `packages/pipeline-engine` | `src/tests/scenarios/linear.scenario.test.ts:110` | `ordine-vars(no-let)` 报错：`let resume: (() => void)                             | undefined;` |
| `packages/pipeline-engine` | `src/tests/scenarios/output.scenario.test.ts:55`  | `unicorn(no-await-expression-member)` warning：`(await readdir(dir)).filter(...)` |

同时仍可见既有 warning：

- `packages/agent/src/claude/runClaude.ts:17`：`eslint(no-control-regex)`
- `packages/plugins/src/github-project-plugin/github-project-plugin.test.ts:43`：`unicorn(consistent-function-scoping)`

因 lint 阶段已失败，下游质量任务未继续执行；后续 Canvas V2 任务不得新增失败。

### Canvas 路由冻结

确认 `apps/app/src/routes` 与 `apps/app/src/routeTree.gen.ts` 中无 `CanvasPageContent`、`@/pages/CanvasPage`、`pages/CanvasPage`、`/canvas` 活跃路由引用；当前 Canvas 入口冻结为 `workspace.$pipelineId.tsx`。

仍存在的旧 Canvas 活跃引用记录为 N6 拆旧范围：

- `apps/app/src/pages/WorkspacePage/WorkspacePage.tsx`
- `apps/app/src/pages/WorkspacePage/AgentBar/*`
- `apps/app/src/pages/ComponentsPage/ComponentEditor/ComponentEditor.tsx`
- `apps/app/src/components/FolderBrowserDialog/*` 的 story/test 引用（这些文件当前已有无关未提交修改，本轮不触碰）

## V2 手册基线（N3-00 · 2026-06-11）

- 工作区此前的未提交改动（SkillToOperationDialog / skills 路由 / SkillsPage）已按指示丢弃（`git restore .`）。
- 施工计划切换：`docs/canvas-v2-plan.md` 移除，由 `docs/ordine重构施工手册v2.md` 取代；视觉原型入库 `docs/prototype/ordien/`（顶层 lib/workspace/jobs 为最新迭代，覆盖嵌套同名文件的组装结果）。
- 类型检查基线：`apps/app` 全量 tsc 现存 **1 个错误**——`src/pages/CanvasPage/OperationNode/OperationNode.tsx(269)` Select onValueChange 签名（位于冻结的旧 Canvas 目录，依赖升级后回归；该目录 N9 整体归档时消失，期间不修改）。后续任务不得新增 tsc 错误。
- 本轮施工环境限制：lint(oxlint)/format(oxfmt)/test(vitest) 依赖 darwin 原生二进制，无法在施工沙箱执行；每任务以全量 tsc 为门禁，测试照常编写，由宿主机 `bun run quality` 统一验证。

## V2 手册执行记录（N3–N9 · 2026-06-11）

- N3–N9 全部完成（commit 标题含任务号）；apps/app 全量 tsc 0 错误（旧 OperationNode 基线错误已随 lint 修复消失）。
- 浏览器实测通过：workspace 画布（12 节点渲染、选中→引用芯片→Context 条）、Jobs 控制台 List/Calendar、Pipelines、归档后无回归。
- 修复记录：`setSelectedIds` 幂等化（xyflow onSelectionChange 每帧新数组导致 Maximum update depth，N6-fix）。
- 留给宿主机/下一轮的事项：
  1. `bun run knip` 清理归档后的死导出 + en/zh 死键（沙箱无法执行 darwin 二进制）；
  2. LocalAgents 的 Configure 抽屉（原型 wizards.jsx ConfigureAgentDrawer）未实现——现有页面无假按钮，属增量功能；
  3. CheckpointDialog 的 Stop（取消运行）已有 `jobs/cancel` 端点，弹卡上仍为禁用态，可一行接通；
  4. N10 清单中"目检截图存 pr-assets/"建议在宿主机跑 dev 后补齐。

## Agent Bar V3 N11-00 基线（2026-06-11）

- proposeActions 已零行为迁出至 `pipelinesService/proposeActions/`（buildProposePrompt / normalizeProposalPayload / validateProposalCatalog / proposeActions），`createPipelinesService.ts` 1236 → 757 行。
- 沙箱内验证：packages/services、apps/app、apps/server 三处 `tsc --noEmit` 全绿。
- vitest / oxlint / oxfmt 为 darwin 二进制，沙箱（linux-arm64 + registry 拦截）无法执行——按 CLAUDE.md §二例外规则，N11 期末由用户在宿主机集中跑 `bun run format && bun run quality`，问题以 fix commit 补齐。

## 宿主机收尾执行（2026-06-11，承接上文 N10 四项遗留）

1. **Task 3 已完成**（commit `feat: 画布运行控制条接通取消运行 (N11-stop)`）：实际禁用态的 Stop 按钮在 `canvas/chrome/TopPill.tsx`（非 CheckpointDialog），已接 `jobs/cancel`（payload `{ jobId: activeJobId }`）；运行中按钮可点，状态由 `useRunPolling` 1.5s 轮询收敛到 `cancelled`。i18n 删 `stopUnavailable`、加 `stopFailed`/`stopped`（en+zh）；新增单测 "cancels the active run via the Stop button"，TopPill 套件 5/5 通过，apps/app tsc 0 错误，无新增 oxlint warning（291/341 的 no-negated-condition 系 `!atRoot`/`!agentOpen` 既有代码，未触碰）。

2. **Task 1 已出报告（未删，待确认删除范围）**：
   - 高置信可删：i18n 顶层 `canvas.*`（264/265 键）——旧 CanvasPage 命名空间，N9 归档后零非归档引用、无动态键，新画布全迁至 `workspace.canvas.*`。
   - 强候选需逐个手确认：`distillations / bestPractices / projects / rules / objects / dashboard` 命名空间仅被 `src/archived/` 引用，但子串扫描无法区分 i18n 键与同名 JS 标识符。
   - 勿删：`runtimes / time / validation / skills / nav / settings / jobs` 等被 `t(\`ns.${x}\`)` 动态键污染，扫描误报为死。
   - knip 的 unused exports/types 绝大多数是 `packages/ui` barrel 与各页 `*PageStoreSlice` 类型（有意保留）；prototype `.jsx` 按指示保留。

3. **Task 2 暂缓（记遗留，不做假抽屉）**：原型 ConfigureAgentDrawer 的 prompt/model/tools 实际属于 `agents` 表（含 `systemPrompt`/`allowedTools`/`allowedSkillIds`，有 `AgentPatchSchema` 与完整 AgentsPage）；LocalAgentsPage 列的是 `agent_runtimes`（仅 `name/type/connection`）。原型把 runtime 与 agent 概念混为一谈；runtime 唯一可配置项是 `name`，Agents 配置已有专页，故不在 LocalAgents 上做重复/伪造抽屉，待产品决定方向后再做。`LocalAgentCard` 已预留 `onConfigure` prop（未传入即不渲染按钮），保持现状。

4. **Task 4 目检截图（pr-assets 已 gitignore，截图仅存盘作证据）**：`ORDINE_LOCAL_MODE=true bun run dev`（9430，tanstackStart 同进程服务 `/api/trpc`）后用 Playwright（指向已装 chromium-1223）截了 `pr-assets/n11-{pipelines,jobs,local-agents,workspace-canvas}.png`。V2 布局均正常渲染：Pipelines console（含 Draft 卡）、Jobs console（stat 卡/Routines/状态 tab）、LocalAgents（"No local agents detected"，确认无 Configure 假按钮）、画布（侧栏/组件面板/空画布"Start with a node"/TopPill 面包屑）。
   - **已知环境问题（非本轮改动）**：jobs/local-agents/workspace 三页出现全局错误 toast `Failed query: select … from "jobs" …`——本地 PGlite 缺 N7 新增列（`total_cost`/`node_statuses`/`triggered_by` 等），即 baseline §"已知本地环境问题" 的迁移漂移；migrations 随 server 启动自动跑仍失败，未在本轮修复。
   - **Stop 运行态未截到**：上述 jobs 子系统查询挂导致无法创建真实运行 job 来展示启用态 Stop；按手册不注入假状态，该接线由新增单测 "cancels the active run via the Stop button" 覆盖。
