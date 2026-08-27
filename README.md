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

The fastest way to run Ordine locally. Docker Desktop is required for the PostgreSQL container:

```sh
docker run -d --name ordine-postgres -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ordine \
  -v ordine-postgres-data:/var/lib/postgresql/data postgres:16-alpine
until docker exec ordine-postgres pg_isready -U postgres -d ordine >/dev/null 2>&1; do sleep 1; done
npm create @ordine -- --yes
```

This starts Ordine at `http://localhost:9430` using the Docker PostgreSQL database, auto-runs migrations, and enables local mode (single-user, no login required).

To stop the app, press `Ctrl+C`. Stop the database separately with `docker stop ordine-postgres`.

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

**Database — Docker PostgreSQL:**

```sh
bun run db:up
# The examples use the same URL in both .env files:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ordine
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

### Connect a coding agent through MCP

ORDINE ships a stdio MCP server plus deletion-safe, product-supported installers for Codex CLI, Claude Code, and OpenCode:

```sh
ordine mcp install codex
ordine mcp install claude
ordine mcp install opencode
ordine mcp status codex
ordine mcp doctor
```

The default MCP policy is safe mode: reads are available, reversible writes require `--allow-write`, and irreversible deletes require `--allow-irreversible` or `--policy yolo`. `doctor` validates the full session-ready chain from MCP registration through the local ORDINE API, DB-backed reads, runtime catalog, and safe tool calls. Open a fresh Codex session after installing so the client reloads the `ordine.*` tool list. See the [runtime and MCP compatibility guide](docs/runtime-mcp-compatibility.md) for durable runs, evidence-layered diagnostics, backup, and uninstall behavior.

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
