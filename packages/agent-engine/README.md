# @repo/agent-engine

**Responsibility: runtime-agnostic dispatch + observability.** Provides the single execution entry point `agentEngine.run(opts)` on top of the `@repo/agent` adapters: it picks a driver from `opts.agent`, unifies the error channel, derives usage totals, and records spans/observability. Upper layers (`@repo/services`' pipelineRunner / pipelinesService) only call this package and never touch a concrete runtime.

Module layout:

- `agentEngine.ts`: dispatch (`DRIVERS[agent]`) + usage accounting + observability trigger only.
- `drivers.ts`: adapts each `@repo/agent` `run<Runtime>` into a uniform `DriverFn` (returning the internal `DriverResult`) and registers it in `DRIVERS`.
- `obs/observability.ts`: `extractTokenTotals` / `buildSpans` / `recordObservability` — assembles claude event streams into spans written to `@repo/obs`.
- `types.ts`: the public contract `AgentRunOptions` / `AgentRunOutcome` / `AgentUsage`, plus the internal `DriverResult` (not exported from the index).

The public contract only exposes runtime-agnostic fields: `AgentRunOutcome = { text; usage: AgentUsage | null }`. `usage` is `null` when the runtime cannot report usage (only claude can today) — **never a fabricated 0**. `ClaudeStreamEvent` is an internal detail of `@repo/agent` and does not appear in this package's public types.
