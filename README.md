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
cd apps/app && bun run db:push
bun dev
```

## Documentation

Visit the [documentation site](https://ordine.dev) for guides, API reference, and skill library.

## License

MIT © 2026 Code Forge AI
