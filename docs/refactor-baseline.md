# 质量基线记录（M0-03）

> 记录 M0-02 后仍存在的质量门失败项。这些不属于后续重构任务的回归，但后续任务**不允许新增失败**。修复它们可作为独立的 fix commit。

## 已存在的测试失败

| 包 | 测试 | 现象 |
|----|------|------|
| `packages/pipeline-engine` | `src/engine/engine.test.ts > operation node > skips operation when operationId is not found` | 期望 `result.ok === true`（跳过），实际引擎对 operation 缺失返回 `ok:false`（OperationNode.ts 对 not found 返回 ScriptExecutionError）。测试语义与实现不一致，基线即失败 |
| `packages/pipeline-engine` | `src/engine/engine.test.ts > inputPath support > reads initial input file when inputPath is provided` | 同样 `result.ok === false`，基线即失败 |

验证方式：在 `refactor/ordinctor-m1` 的 M0-02 提交后运行 `bun run quality`，全量 `check-types` 通过，质量门最终停在上述两个既有测试失败（2026-06-10 验证）。

## 已知本地环境问题（不计入质量门新增失败）

1. Nitro 全量 build 在原作者本地环境失败（Node 内置 `https` 解析问题），与本重构无关。
2. Playwright E2E 在本地 `/login` networkidle 前超时（已知问题）。

## 非阻塞 lint warning

`bun run quality` 当前还会打印少量 oxlint warning，但不会导致命令失败。后续任务不得新增 warning。
