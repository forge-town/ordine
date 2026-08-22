# Product runtime and MCP support

This milestone formally supports three local coding-agent clients: Codex CLI, Claude Code, and OpenCode. Other runtime registry entries remain experimental or unchanged and are not part of this acceptance claim.

## Durable Agent Runs

Every formal runtime invocation crosses the Agent Run control layer. A run is created first, returns an ID immediately, and records normalized events before broadcasting them. The public states are `queued`, `running`, `cancelling`, `completed`, `failed`, `cancelled`, `timed_out`, and `interrupted`.

`GET /api/agent-runs/:id/events` supports `after=<sequence>` and `Last-Event-ID`. The UI stores the latest sequence, deduplicates replayed envelopes, and reconnects after refresh or a dropped stream. A server restart marks unfinished runs `interrupted`; ORDINE does not attach to an unknown old PID.

| Runtime     | Structured mode          | Native resume | Default `workspace-write` isolation                                  | Network boundary                                      |
| ----------- | ------------------------ | ------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Codex CLI   | `codex exec --json`      | `exec resume` | Native Codex `workspace-write` sandbox                               | Native Codex sandbox/network configuration            |
| Claude Code | stream-json input/output | `--resume`    | `acceptEdits` plus an explicit tool allow-list (CLI policy)          | Best-effort CLI policy; surfaced honestly in the UI   |
| OpenCode    | `run --format json`      | `-s`          | Explicit permission rules deny external paths and dangerous commands | Best-effort CLI policy; `--auto` cannot override deny |

The runtime scanner, capability probe, connection test, and real invocation use the same absolute executable path. `workspace-write` is the default permission mode and network access is enabled by default. `full-access` is never inferred: it requires an explicit user confirmation for the individual run. Only that confirmed mode may select Codex's dangerous bypass, Claude Code's `bypassPermissions`, or an OpenCode `--auto` capability advertised by the installed CLI. OpenCode's generated policy keeps explicit `deny` rules authoritative, matching the [official permission semantics](https://opencode.ai/docs/permissions/).

The execution picker is adapted from OpenDesign's local CLI and model selection flow: only launchable supported runtimes can be selected, each runtime keeps its own model/reasoning/speed preference, long model catalogs are searchable, and runtimes that advertise the capability accept an explicit custom model ID. Provider billing, account, campaign, and daemon UI from OpenDesign are intentionally outside ORDINE's local-runtime boundary.

## Connection test

The Runtime detail drawer distinguishes executable detection, command launch, and a real model response matching `ORDINE_CONNECTION_OK`. The final step consumes one provider request and may use quota. A detected binary or successful `--help` probe is not reported as a successful model call.

## MCP commands

The formal commands are:

```sh
ordine mcp install codex
ordine mcp status codex
ordine mcp doctor codex
ordine mcp uninstall codex

ordine mcp install claude       # claude-code is accepted as an alias
ordine mcp install opencode
```

`status` reports registration only. `doctor` starts the configured ORDINE MCP command with the official SDK and separately proves command launch, `initialize`, `tools/list`, and a safe `ordine.list_jobs` call. Only the final complete evidence chain is `healthy`.

NPM-installed configurations contain an absolute Node-compatible runtime path and an absolute ORDINE CLI file path. Desktop packages include an independent `ordine-mcp` sidecar. Desktop authentication is read from `~/.ordine/.desktop-token` for every API request, so no expiring plaintext token is embedded in client configuration.

JSON installation uses a temporary file and atomic rename, creates a timestamped backup before changing an existing file, refuses to overwrite a same-named non-ORDINE entry, and refuses to uninstall a drifted entry. Codex and Claude installations probe the target client's registration before and after mutation.

Global client configuration from the UI is allowed only in authenticated Desktop mode. Web/server mode returns a copyable CLI command and does not mutate user-global configuration.

## Retention and safety

Run events are retained for 30 days. Known credential patterns and sensitive keys are redacted before persistence. Individual large strings and oversized serialized events are truncated with an explicit diagnostic reason. Cancellation terminates the exact child process tree; POSIX uses process-group TERM then KILL, while Windows uses exact-PID `taskkill /T` then `/F` and verifies that the PID is gone.

## OpenDesign attribution

The three local CLI definitions, event-replay, parser/resume-guard, and deletion-safe installer-planner structure were adapted from OpenDesign. ORDINE retains its own schemas, database, API, run-scoped MCP injection, and clients. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and the bundled Apache-2.0 license.
