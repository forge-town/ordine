# COD-369 Windows acceptance summary

Generated for the `cod-369-runtime-mcp-compatibility` worktree on 2026-08-23.
Credentials, desktop tokens, prompts, model output, and native session handles are intentionally omitted.

## Product policy verified

- Local Codex, Claude Code, and OpenCode runs default to `full-access`, as explicitly selected for this milestone.
- An explicit `read-only` or `workspace-write` request still downscopes the run.
- The effective permission mode is persisted with the run and shown in the runtime UI.
- Formal product callers use the Agent Run control layer; the static spawn-boundary test rejects direct business-layer spawning of these three runtimes.

## Real local Agent runs

| Runtime | Version | First run | Native resume | Cancel | Durable evidence | PID cleanup | File SHA-256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Codex | 0.149.0 | `8275626a-5b5b-4349-b466-f5ead86af63e` completed | `0df59620-249d-4c5c-9461-bdb3126b3678` completed | `f315a4a7-b0d1-47b2-9a3f-fefb26263483` cancelled | session, message, tools, artifact, usage, terminal | clean | `3c1c8dfddcbc0bcab9ae62037a6cfde58f16fbcd54bc302f47969b38b77b2db4` |
| Claude Code | 2.1.207 | `4cea4795-4db7-45f8-8f80-8068b2940c31` completed | `b1d8a4b0-5886-419b-9a0b-bf80cf36cc18` completed | `ee2fda83-94cb-4a93-8f0c-1b78cdf8460f` cancelled | session, thinking, text, tools, usage, terminal | clean | `969c04fb78922d47fbaee8dc87675bfac6dffcabd50063944b0c126fa8cbd559` |
| OpenCode | 1.18.21 | `a89a22f9-33f8-47b6-a4bf-f8e61a6ad11e` completed | `a6a3783b-5b1c-4f4d-bf44-a06e63e40581` completed | `3d5ea2ac-a52a-4180-be35-29369d80a880` cancelled | session, text, tools, usage, terminal | clean | `48b772f05316f72b102652bf8b44a908c7ee5c00a802d775bdd85bd3a3812d16` |

The machine-readable reports are stored in each runtime directory as `acceptance.json`. Every recorded acceptance command reached exit code 0.

## MCP client acceptance

The `ordine-cod369-20260823-current` registration was exercised with real Codex, Claude Code, and OpenCode client configuration:

- install and post-install registration probe passed;
- absolute Node executable and absolute ORDINE CLI file were used;
- `initialize`, `tools/list`, and the safe `ordine.list_jobs` call passed for all three clients;
- each doctor response exposed 21 tools;
- uninstall passed and the final status was `absent` for all three clients;
- the desktop token was dynamically read from a token file and is not included in the evidence report.

The machine-readable report is `mcp/mcp-acceptance.json`.

## Replay, recovery, and UI evidence

- The service test proves database commit occurs before event broadcast.
- The server route test proves exact `Last-Event-ID` replay, explicit `after` precedence, replay of the terminal event, and idempotent cancellation.
- The restart recovery test proves unfinished runs receive a persisted diagnostic followed by an `interrupted` terminal event and run-state patch.
- The UI E2E acceptance passed for desktop light, mobile dark, and tablet connection-test layouts. Screenshots are under `.artifacts/cod-369-ui-20260823/`.

## Automated verification

- Root typecheck: 21/21 tasks passed, exit code 0.
- Root lint: 19/19 tasks passed, exit code 0 (warnings only).
- Schemas: 22 files, 84 tests passed.
- Agent adapters and runtime process layer: 28 files passed, 1 gated file skipped; 132 tests passed, 3 gated tests skipped.
- Agent engine: 2 files, 26 tests passed.
- Services: 64 files passed, 1 gated file skipped; 507 tests passed, 4 gated tests skipped.
- CLI: 6 files passed, 1 gated file skipped; 78 tests passed, 4 gated tests skipped.
- Server: 7 files, 107 tests passed.
- App: 117 files, 539 tests passed.
- Views: 95 files, 409 tests passed.
- Database schema: 5 files, 14 tests passed.
- Create/migrations: 3 files, 35 tests passed; focused migration suite 9 tests passed.
- UI Playwright acceptance: 3 scenarios passed.

## Remaining platform boundary

Windows is the only platform with real installed-client acceptance in this milestone. macOS and Linux remain implementation/CI-compatible, not real-client verified.
