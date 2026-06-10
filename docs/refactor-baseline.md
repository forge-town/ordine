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
