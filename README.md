# Ordine

AI-first meta-orchestration engine.

Define operations, compose pipelines, choose your favorite AI agent, and automate any workflow. Code quality automation available as a built-in plugin.

> 🚧 Ordine is currently in **Preview** stage. APIs and features may change.

## What It Does

- **Objects** — Typed inputs for pipelines (folders, code files, GitHub projects, or custom types via plugins)
- **Operations** — Atomic tasks with configurable AI agent or script executors
- **Pipelines** — Chain operations into multi-step DAG workflows
- **Skills** — Pluggable AI agent capabilities that power operation execution
- **Agent** — Choose any AI agent as executor — Claude, GPT, Gemini, or your own
- **Jobs** — Track background execution with real-time progress and traces
- **Plugins** — Extend with new object types, operations, and domain-specific workflows

## Quick Start

```sh
bun install
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env

# Set DATABASE_URL in both env files first
cd apps/app && bun run db:push && cd ../..

bun dev
```

Main app: `http://localhost:9430`

API server: `http://localhost:9433`

## Project Status

Ordine is still in preview. APIs, data models, and workflows may change before beta.

## Contributing

External contributions are paused until the beta release. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the current policy.

## Security

Ordine does not have a public security intake process yet. See [SECURITY.md](./SECURITY.md) for the current preview-stage policy.

## Documentation

Visit the [documentation site](https://docs.ordine.ai) for guides, API reference, and skill library.

## License

MIT © 2026 Code Forge AI
