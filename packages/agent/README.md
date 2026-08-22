# @repo/agent

**Responsibility: runtime adapters.** Wraps each concrete local agent runtime — process spawning, native protocol handshakes, streaming event normalization, cancellation, session continuation, and job-scoped MCP injection — into a single `run<Runtime>` function. This package is **only** concerned with "how to invoke a given runtime"; it does no dispatching, observability, or business orchestration.

Boundary (division of labor with `@repo/agent-engine`):

- Native adapters cover Claude Code, Codex, Hermes, Mastra, OpenClaw, Pi, OpenCode, Kimi, DeepSeek Reasonix, DeepSeek Harness, Kiro, Trae, and Mistral Vibe. ACP-compatible agents share one ACP implementation; Codex/OpenCode share structured-event normalization; Pi uses its RPC protocol.
- All adapters converge on the versioned `RuntimeEvent` contract from `@repo/schemas`. Raw vendor frames stay inside this package.
- It does not depend on `@repo/agent-engine`, `@repo/services`, or `@repo/pipeline-engine`. Dispatch and observability live above.
- Claude-specific types such as `ClaudeStreamEvent` are internal details of this package and must not appear in `@repo/agent-engine`'s public contract.

To add a runtime: implement `run<Runtime>` under `src/<runtime>/`, export it, then register it in `DRIVERS` in `@repo/agent-engine`'s `drivers.ts`.
