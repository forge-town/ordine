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

## Canvas V2 N0 基线（2026-06-11 11:15 CST）

本轮从 `refactor/ordinctor-m1` 切出 `refactor/canvas-v2`，按 Canvas V2 施工手册进入新画布重写阶段。

### 质量门现状

运行 `bun run quality` 时质量门提前停在 `@repo/pipeline-engine#quality` 的 oxlint：

| 包 | 文件 | 现象 |
| --- | --- | --- |
| `packages/pipeline-engine` | `src/tests/scenarios/linear.scenario.test.ts:110` | `ordine-vars(no-let)` 报错：`let resume: (() => void) | undefined;` |
| `packages/pipeline-engine` | `src/tests/scenarios/output.scenario.test.ts:55` | `unicorn(no-await-expression-member)` warning：`(await readdir(dir)).filter(...)` |

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
