# @repo/agent-engine

**职责：runtime 无关的调度 + 可观测性。** 在 `@repo/agent` 的适配器之上提供唯一执行入口 `agentEngine.run(opts)`：按 `opts.agent` 选择 driver、统一错误通道、折算用量、记录 span/observability。上层（`@repo/services` 的 pipelineRunner / pipelinesService）只调用本包，不直接碰具体 runtime。

模块划分（H1-05 瘦身后）：

- `agentEngine.ts`：仅调度（`DRIVERS[agent]`）+ 用量折算 + 触发观测，≤120 行。
- `drivers.ts`：把每个 `@repo/agent` 的 `run<Runtime>` 适配成统一的 `DriverFn`（内部返回 `DriverResult`），并注册到 `DRIVERS`。
- `obs/observability.ts`：`extractTokenTotals` / `buildSpans` / `recordObservability`——把 claude 事件流拼装成 span 写入 `@repo/obs`。
- `types.ts`：公开契约 `AgentRunOptions` / `AgentRunOutcome` / `AgentUsage`，以及内部 `DriverResult`（不从 index 公开）。

公开契约只暴露 runtime 无关字段：`AgentRunOutcome = { text; usage: AgentUsage | null }`。`usage` 为 `null` 表示该 runtime 无法采集用量（仅 claude 当前可采），**不伪造 0**（H1-03）。`ClaudeStreamEvent` 是 `@repo/agent` 的内部细节，不出现在本包公开类型中。
