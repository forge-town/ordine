<div align="center">

<img alt="Ordine" src="docs/assets/logo.svg" width="80">

# Ordine

**Define once. Let your agents handle the rest.**

The open-source AI Agent first work orchestration framework.<br/>
Compose operations into pipelines, plug in any AI agent, and automate any workflow — code quality, data processing, or your own domain.

[![CI](https://github.com/forge-town/ordine/actions/workflows/ci.yml/badge.svg)](https://github.com/forge-town/ordine/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/forge-town/ordine?style=flat)](https://github.com/forge-town/ordine/stargazers)

[Documentation](https://docs.ordine.ai) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

**English | [简体中文](README.zh-CN.md)**

</div>

> 🚧 Ordine is currently in **Preview**. APIs and features may change before beta.

---

## What is Ordine?

Ordine is an **AI Agent first work Orchestration framework** that lets you define typed operations, compose them into DAG pipelines, and execute them with any AI agent or script executor.

No more scattered scripts. No more babysitting agent runs. Define your workflow once as a pipeline — then let Claude, GPT, Gemini, or your own agent execute it. Agents are the primary runtime, not an afterthought. Code quality automation ships as a built-in plugin.

## Features

- **Objects** — Typed pipeline inputs (folders, code files, GitHub projects, or custom types via plugins)
- **Operations** — Atomic tasks with configurable AI agent or script executors
- **Pipelines** — Chain operations into multi-step DAG workflows
- **Skills** — Pluggable AI agent capabilities that power operation execution
- **Agent** — Choose any AI agent as executor — Claude, GPT, Gemini, or your own
- **Jobs** — Track background execution with real-time progress and traces
- **Plugins** — Extend with new object types, operations, and domain-specific workflows

---

## Quick Start

### Option 1 — Quick install (recommended)

The fastest way to run Ordine locally — no external database or configuration needed:

```sh
npm create @ordine -- --yes
```

This starts Ordine at `http://localhost:9430` with embedded PostgreSQL (PGLite), auto-runs migrations, and enables local mode (single-user, no login required).

To stop, press `Ctrl+C`.

For interactive mode (choose data directory, port, etc.):

```sh
npm create @ordine
```

### Option 2 — Develop from source

```sh
# Clone the repository
git clone https://github.com/forge-town/ordine.git
cd ordine

# Install dependencies
bun install

# Create env files
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env
```

**Database — pick one:**

- **PGLite (embedded, no external DB required):**

  ```sh
  # In both .env files, set:
  PGLITE_DATA_DIR=./.pglite
  ```

- **PostgreSQL (external):**
  ```sh
  # In both .env files, set:
  DATABASE_URL=postgresql://postgres:<password>@localhost:5432/ordine
  ```

Push the schema:

```sh
cd apps/app && bun run db:push && cd ../..
```

Start development:

```sh
bun dev
```

| Service    | URL                   |
| ---------- | --------------------- |
| Main app   | http://localhost:9430 |
| API server | http://localhost:9433 |

> **💡 Local Mode (self-hosted, single-user):**
> Set `ORDINE_LOCAL_MODE=true` in `apps/app/.env` to skip the login page entirely.
> A default local user is auto-created and logged in on first visit.
> ⚠️ Do NOT enable in shared or production environments.

---

## Project Status

Ordine is in preview. APIs, data models, and workflows may change before beta.

## Contributing

External contributions are paused until the beta release. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the current policy.

## Security

Ordine does not have a public security intake process yet. See [SECURITY.md](./SECURITY.md) for the current preview-stage policy.

## Documentation

Visit the [documentation site](https://docs.ordine.ai) for guides, API reference, and skill library.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=forge-town/ordine&type=Date)](https://star-history.com/#forge-town/ordine&Date)

## License

MIT © 2026 Code Forge AI
