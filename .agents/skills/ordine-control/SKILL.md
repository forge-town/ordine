---
name: ordine-control
description: Operate a running local Ordine instance from Codex through the checked-in CLI. Use to list or inspect pipelines, run a pipeline, inspect jobs, or read job traces. Do not use for Canvas or other UI-only behavior.
---

# Ordine Control

Use the repository CLI as the supported Codex-facing interface. This skill does not turn Ordine into an MCP server; it provides the local Skill + CLI path while the MCP surface is developed separately.

## Preconditions

1. Work from the Ordine repository root.
2. Confirm the target server with `ORDINE_API_URL`. The CLI and standalone API server default to `http://localhost:9433`.
3. Confirm the server is reachable with `curl -fsS "$ORDINE_API_URL/health"` before any write or run command.
4. If Desktop mode requires authentication, read `ORDINE_DESKTOP_AUTH_TOKEN` from the environment. Never print, persist, or copy the token into a command argument, file, log, or response.
5. Prefer an installed `ordine` executable. In a source checkout, use `bun apps/cli/src/index.ts`.

## Machine-readable commands

Place the global `--json` option before the command:

```bash
bun apps/cli/src/index.ts --json pipelines list
bun apps/cli/src/index.ts --json pipelines get <pipeline-id>
bun apps/cli/src/index.ts --json run <pipeline-id> --no-follow
bun apps/cli/src/index.ts --json run <pipeline-id>
bun apps/cli/src/index.ts --json jobs list
bun apps/cli/src/index.ts --json jobs get <job-id>
bun apps/cli/src/index.ts --json jobs traces <job-id>
```

- `run --no-follow` returns `{ "jobId": "..." }`.
- A following `run` returns `{ "job": {...}, "traces": [...] }` after the job reaches a terminal state or pauses.
- Only `done` exits zero. `paused`, `failed`, `cancelled`, `expired`, and `skipped` stop following and exit non-zero. Inspect the JSON written to stdout and the concise error written to stderr.
- If job traces cannot be fetched, the CLI exits non-zero and adds `tracesError` to the JSON instead of silently reporting an empty trace list.

## Workflow

1. List pipelines as JSON and select an existing pipeline ID; do not guess IDs.
2. Inspect the pipeline before running it.
3. Treat running a pipeline as a state-changing action. Run only when the user asked to execute or when execution is an explicit validation step within the task.
4. Prefer `--no-follow` for asynchronous work. Use the returned job ID with `jobs get` and `jobs traces`.
5. Report the pipeline ID, job ID, terminal status, relevant trace evidence, and whether the path was live or mocked.

## Safety boundaries

- Do not use CLI/REST checks as evidence for Canvas rendering, drag-and-drop, browser authentication, or Desktop IPC behavior.
- Do not delete pipelines or jobs unless the user explicitly requests deletion and the exact ID has been verified.
- Do not start a persistent server, change authentication, or modify environment files unless the task includes local startup or configuration.
- If health, authentication, or a command fails repeatedly, stop and report the exact failing layer instead of retrying blindly.
