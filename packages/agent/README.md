# @repo/agent

**Responsibility: runtime adapters.** Wraps each concrete LLM/agent runtime (`claude-code` / `codex` / `hermes` / `mastra` / `openclaw`) — process spawning, argument pass-through, streaming output, and native event parsing — into a single `run<Runtime>` function. This package is **only** concerned with "how to invoke a given runtime"; it does no dispatching, observability, retries, or business orchestration.

Boundary (division of labor with `@repo/agent-engine`):

- This package exports `runClaude` / `runCodex` / `runHermes` / `runMastra` / `runOpenclaw`, the input/output schemas of each runtime, `extractJsonFromText` (a runtime-agnostic JSON extraction utility, moved out of the claude adapter into `src/json/`), and `listMcpToolsStdio` (a minimal MCP stdio client in `src/mcp/`).
- It does not depend on `@repo/agent-engine`, `@repo/services`, or `@repo/pipeline-engine`. Dispatch and observability live above.
- Claude-specific types such as `ClaudeStreamEvent` are internal details of this package and must not appear in `@repo/agent-engine`'s public contract.

To add a runtime: implement `run<Runtime>` under `src/<runtime>/`, export it, then register it in `DRIVERS` in `@repo/agent-engine`'s `drivers.ts`.
