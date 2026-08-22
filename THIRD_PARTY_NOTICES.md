# Third-party notices

## OpenDesign

- Source: <https://github.com/nexu-io/open-design>
- Source revision reviewed: `105dcf37648f53a620a45f092a4ac53c1fcd2e8b`
- License: Apache License 2.0
- Copyright: Copyright 2026 Open Design contributors
- License copy: `licenses/Apache-2.0.txt`

ORDINE's Codex, Claude Code, and OpenCode local CLI invocation definitions, normalized runtime parsing, native-session resume guard, durable run/event replay, deletion-safe MCP installer planning, and local CLI/model selection interaction were adapted from the corresponding OpenDesign architecture and tests. The ORDINE implementation was modified for ORDINE's schemas, PostgreSQL persistence, run-scoped MCP injection, desktop authentication, API routes, and user interfaces.

Relevant ORDINE paths:

- `packages/agent/src/runtime/`
- `packages/agent/src/codex/runCodex.ts`
- `packages/agent/src/claude/runClaude.ts`
- `packages/agent/src/opencode/runOpencode.ts`
- `packages/agent/src/scan/probeRuntimeCapabilities.ts`
- `packages/services/src/agentRunsService/`
- `packages/views/src/components/AgentExecutionPicker/`
- `apps/server/src/routes/agentRuns.ts`
- `apps/cli/src/mcp/installer.ts`
- `apps/cli/src/mcp/installRegistry.ts`

The selector behavior was adapted from OpenDesign's `AgentPicker`, `InlineModelSwitcher`, `modelOptions`, and `agentModelSelection` components. No OpenDesign brand assets, daemon, account/billing UI, or campaign UI are included. ORDINE-original code remains under the repository's MIT license; the Apache-2.0 terms and retained copyright notice apply to adapted OpenDesign material.
