# COD-369 Windows acceptance summary

Generated on 2026-08-22 (Asia/Shanghai). Secrets and database credentials are omitted. The temporary desktop token used by the MCP protocol test was removed after verification.

## Runtime acceptance

| Runtime     | Version | First run                                          | Native resume                                      | Cancellation                                       | Process tree | Result |
| ----------- | ------- | -------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ------------ | ------ |
| Claude Code | 2.1.207 | completed (`3aa08b68-f160-4ad7-8970-6d6b9ffeea89`) | completed (`08e12b7e-6d37-4a58-bb0e-130a3d2f60c0`) | cancelled (`f043a4a3-082b-46c9-97c8-318f389db17a`) | cleaned      | pass   |
| OpenCode    | 1.18.21 | completed (`45727261-4aea-4b6d-9eba-e4003d657722`) | completed (`816c9998-467f-4191-9889-dc71463106df`) | cancelled (`ff318922-e401-4474-9496-d190cb7ea823`) | cleaned      | pass   |
| Codex CLI   | 0.149.0 | completed (`23f340f3-173f-4d9c-b5f9-b077a3ee5135`) | completed (`cdf7deb1-5f09-441f-a06d-ed2665acdd66`) | cancelled (`bb28d8b4-951a-431c-a0c0-c5ee9f0df4e7`) | cleaned      | pass   |

Claude created and resumed work on `acceptance.txt` with SHA-256 `969c04fb78922d47fbaee8dc87675bfac6dffcabd50063944b0c126fa8cbd559`. OpenCode produced SHA-256 `48b772f05316f72b102652bf8b44a908c7ee5c00a802d775bdd85bd3a3812d16`. Codex produced SHA-256 `3c1c8dfddcbc0bcab9ae62037a6cfde58f16fbcd54bc302f47969b38b77b2db4`.

The Codex quota recheck first completed through the ORDINE control layer and returned the exact marker `ORDINE_CODEX_QUOTA_RESTORED`, with native session capture, usage, persisted sequences 1387-1393, terminal truth, and PID cleanup. The earlier ORDINE-specific Windows `workspace-write` invocation then stalled in the code-mode host before creating a file.

ORDINE now uses OpenDesign's current local-agent invocation behavior: Codex selects `danger-full-access` on Windows/WSL, includes OpenDesign's shell-environment policy overrides, sends the prompt on stdin, uses create-only `-C`, and resumes with `exec resume` plus the captured thread id. The rerun completed create/resume/cancel with persisted sequences 1394-1427 and cleaned PIDs 8580, 40488, and 55364. Claude uses stream-json with `bypassPermissions`; OpenCode probes `run --help` and did not synthesize the unavailable `--dangerously-skip-permissions` flag on installed version 1.18.21.

## Event replay

The completed Claude first run persisted 146 events with unique sequences 10-155. Reconnecting with `Last-Event-ID: 83` replayed exactly sequences 84-155 (72 unique events), including the terminal event, with no gap or duplicate.

## MCP acceptance

Server name: `ordine-cod369-20260822-2124`.

Codex, Claude Code, and OpenCode each passed install, registration status, absolute command launch, MCP `initialize`, `tools/list`, safe `ordine.list_jobs`, uninstall, and final absence. Each doctor run listed 21 tools. The launch used an absolute Node executable and absolute ORDINE CLI file with desktop authentication read dynamically from a token file. The test token was not retained.

## Automated verification

- Root typecheck: 21/21 tasks passed.
- Root lint: 19/19 tasks passed (warnings only).
- Schemas: 79/79 tests passed.
- Agent: 125 passed, 3 environment-gated tests skipped.
- Agent engine: 25/25 tests passed.
- Services: 505 passed, 4 Windows acceptance tests skipped by default.
- CLI: 78 passed, 4 Windows acceptance tests skipped by default.
- Server focused routes: 28/28 tests passed.
- App: 531/531 tests passed.
- Views: 403/403 tests passed.
- Create migrations against PostgreSQL: 35/35 tests passed.
- `git diff --check`: passed.
- The root aggregate test command reached an unrelated Windows Bash baseline failure in `packages/pipeline-engine/src/infrastructure/infrastructure.test.ts` (180 passed, 1 failed); all affected Agent, Agent Engine, Services, Views, and App suites above passed independently.
- Changed source files are formatted with the repository config. The repository-wide format check still reports 181 existing files outside this focused parity change.

## Remaining external acceptance

macOS and Linux remain implementation/CI-compatible but are not claimed as real-client verified in this artifact.
