# Claude Code Entry Point

@AGENTS.md

This file is a thin bridge for Claude Code sessions. `AGENTS.md` remains the
single source of truth for repository workflow, project structure, Git/PR rules,
verification expectations, and known local environment issues.

Before editing code, read `CodeGuidelines.md`; it is the authoritative source
for backend-first development, error handling, Zod-derived types, DAO/Service
boundaries, frontend data access, and testing rules. Do not import the whole
file automatically for every session, because many sessions are not code edits.

Claude-specific working notes:

- Work on a feature/fix branch and open PRs against the upstream `develop`
  branch.
- Do not push directly to protected or upstream mainline branches.
- Keep `CLAUDE.md` public-safe: no credentials, internal-only details, or local
  personal paths.
- Treat `bun run quality` and `bun run format:check` as the default completion
  gate; add browser evidence for UI behavior or visual changes.
- Keep this file small. Update `AGENTS.md` or `CodeGuidelines.md` when changing
  the actual team rules.
