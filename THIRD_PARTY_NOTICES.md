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

## Animate UI

- Source: <https://github.com/imskyleen/animate-ui>
- Source revision reviewed: `efeb96ffd7a3b7a4868667e4ac3c346620fb3044`
- License: MIT + Commons Clause License Condition
- Copyright: Copyright (c) 2025 Elliot Sutton
- License copy: `licenses/Animate-UI-MIT-Commons-Clause.txt`

ORDINE's shared Dialog, Popover, Tooltip, Dropdown Menu, Context Menu, Sheet,
and Select motion adapters were deep-adapted from Animate UI's Base UI and
Radix recipes. The primitive layer remains `@base-ui/react`; legacy
`@base-ui-components/react` and Radix imports are not included. Adapted files
are distributed as part of the ORDINE application and retain this notice; the
Commons Clause restriction applies to redistributing the components themselves
in their original form.
