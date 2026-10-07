# Full Task2 Service Structure Specification Review

**结论：PASS_CHECKPOINT（规格范围）**

本报告是对当前 27 Service 迁移快照的独立规格审查，不是代码质量审查、全量运行时行为证明、生产验收、PR 或合并结论。审查仓库：`/Users/amin/projects/ordine-service-structure`；基线：`03721ab082172699479690714b15c342c0144382`。本轮只读检查并写入本报告，没有修改源码、数据库或发布状态。

## 实际 guards

- `bun docs/reports/2026-10-06-service-structure/verify-public-api.ts`：退出 0，`unchanged: true`；`src/index.ts` 182、`src/execution/index.ts` 44、`src/executionMigration/index.ts` 12 个公开符号，`changedSymbols: []`。
- `bun docs/reports/2026-10-06-service-structure/verify-test-preservation.ts`：27 个 Service 全部 `missingAssertions=0`。基线 15 个 AgentRuns 原测试声明在其专门报告中已逐条复核；本轮全局检查的唯一标题差异是 routines 的 `reads delegate to the dao and wrap meta`，当前拆分为 `getAll` 的 `reads all routines and wraps meta`，对应原断言、DAO 调用和 meta 字段均保留，属于按真实 method 责任改名，不是遗漏。
- `bun docs/reports/2026-10-06-service-structure/verify-structure.ts packages/services --require-conforming`：退出 0；当前 `conforms: true`，`block=0`、`warn=0`、`allow=61`；27 Service scope preserved；未知 root、root symlink、未知 leaf、未知资产均被 block；scenario、声明的 snapshot/PDF fixture 均被接受；method/helper canonical contract、标准 spec 和实现文件均 enforced。61 个 allow 是已批准的 execution/canvas/archived 等支持结构，不是全局放宽。

## 27 Service 入口和边界

当前存在且各有 `<name>.service.ts` 的 27 个目录为：`agentControlService`, `agentRunsService`, `agentRuntimesService`, `agentsService`, `capabilityCatalogService`, `capabilityHarvestService`, `connectorsService`, `conversationMessagesService`, `distillationsService`, `executionService`, `filesystemService`, `githubProjectsService`, `jobsService`, `operationOutputItemTemplatesService`, `operationRunnerService`, `operationsService`, `pipelineAgentSessionsService`, `pipelineAssetsService`, `pipelineRunnerService`, `pipelinesService`, `projectsService`, `refinementsService`, `routineSchedulerService`, `routinesService`, `settingsService`, `skillsService`, `usageService`。

结构报告确认所有 27 个 Service 与基线清单一致；methods/helpers 集合和 canonical leaf contracts 通过。根包公开入口保留，且 public API guard 对三条入口未观察到符号、值/类型角色或函数参数声明变化。该 guard 的已知边界是不能单独证明返回值和运行行为，因此本报告不把它升级为完整 API/行为证明。

抽查闭包状态与 receiver 规则：迁移后的 factory 以 getter 读取同一实例状态，未发现把 map/set/admission clone 到模块级或提前缓存 getter 的模式。全局 AST 回读记录 47 个叶子声明参数/body/返回注解/generic 无差异；其中 43 个原裸调用保持裸 receiver，234 个原对象成员调用 receiver 保持。该证据覆盖抽查和已完成的 AgentRuns/AgentControl receiver 回归，不替代逐个服务质量测试。

## Execution canonical 与 SQL 路径

`executionService/execution.service.ts` 仍是薄组装入口；`methods/` 与 `helpers/` 叶子包含标准实现和 spec，Execution 支持模块（`executionActors`、`executionArtifacts`、`executionGateway`、`canvasExecution`、`jobLease` 等）保持独立边界。`packages/services/src/executionMigration/` 保留 README、schema、validator、fixtures 和 integration tests；README 中的 canonical JSON/hash、叶字段处置、compound/active-state 拒绝规则仍在源码说明和测试中。

实际运行：`bun x vitest run src/executionMigration/tests/validateExecutionMigration.test.ts src/executionMigration/tests/importExecutionMigration.integration.test.ts`：1 个验证文件通过、1 个数据库集成文件按环境 skip；16 tests passed、3 skipped。数据库集成未伪造为通过。`apps/create/migrations-v2/0001_execution.sql` 存在，integration test 使用该路径；本轮未连接日常数据库。

## 未升级为全局通过的边界

本报告没有运行全包 test/lint/consumer build，也没有运行真实 LLM、Windows、生产数据库、外部服务或浏览器验收；这些证据必须在质量/发布审查中分别报告。`allow=61` 支持结构已由 guard 的严格负例证明不会放宽未知 leaf/asset，但其业务质量仍需后续审查。测试保留 guard 是 AST 断言/标题辅助工具，不替代并发、取消、错误 cause、事务顺序和外部副作用验证。

因此本报告给出 **PASS_CHECKPOINT（全 Task2 规格结构范围）**，并明确不宣称质量通过、运行时等价或发布完成。
