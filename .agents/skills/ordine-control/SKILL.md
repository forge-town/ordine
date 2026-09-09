---
name: ordine-control
description: Use the local Ordine CLI to inspect pipelines, execute authorized runs, and read jobs or traces.
---

# Ordine Control

Use the installed `ordine` CLI or, from the repository root, `bun apps/cli/src/index.ts`. This skill covers CLI control; MCP and UI behavior have separate interfaces.

## Target and authorization

- Confirm the intended `ORDINE_API_URL` (default `http://localhost:9433`) before a write or run. Check `/health` when establishing or diagnosing the connection, not before every command.
- The CLI reads `ORDINE_DESKTOP_AUTH_TOKEN` or `ORDINE_DESKTOP_AUTH_TOKEN_FILE` from the environment. Reuse configured authentication; never print or copy token values into arguments, files, logs or responses.
- Use the supplied verified ID directly; list candidates only when the target is unknown. Inspect a pipeline's configuration and input before running it unless already established in this task.
- Execute when the user asked to run it or execution is part of the authorized validation. Delete only explicitly requested, verified resources. Local startup/configuration follows the task scope; do not change authentication to bypass a failure.

## Commands

Place the global `--json` option before the command:

```bash
bun apps/cli/src/index.ts --json pipelines list
bun apps/cli/src/index.ts --json pipelines get <pipeline-id>
bun apps/cli/src/index.ts --json run <pipeline-id> --no-follow
bun apps/cli/src/index.ts --json run <pipeline-id>
bun apps/cli/src/index.ts --json jobs get <job-id>
bun apps/cli/src/index.ts --json jobs traces <job-id>
```

`--no-follow` returns `{ "jobId": "..." }`; otherwise `run` follows and returns `{ "job": {...}, "traces": [...] }`. Choose based on whether other work can proceed. A successful read does not require a second health probe or a pipeline run.

Only a `done` run exits zero. `paused`, `failed`, `cancelled`, `expired`, and `skipped` stop following and exit nonzero. A trace-fetch failure also exits nonzero and adds `tracesError`; inspect stdout JSON and stderr. Diagnose a repeated failure before retrying; do not create another run just to poll.

Report the pipeline/job IDs, actual status, relevant traces, and live versus mocked path. For an artifact-producing task, verify the requested file/content and provenance; `done` alone is insufficient. CLI/REST evidence does not establish Canvas rendering, browser authentication, drag-and-drop or Desktop IPC behavior.
