# What is Ordine?

Ordine is a **meta-orchestration engine for code quality**. It lets you define best practices, compose them into operations, wire operations through pipelines, and let AI agents + scripts enforce them automatically.

## The Problem

Modern codebases grow faster than teams can review. Code style, architecture patterns, security practices, and documentation standards drift over time. Manual enforcement doesn't scale.

## The Solution

Ordine provides a structured way to:

1. **Capture** your team's coding standards as machine-readable best practices
2. **Define** operations that check or fix code using AI agents or scripts
3. **Compose** operations into multi-step pipelines (DAG execution)
4. **Automate** enforcement through rules that trigger pipelines on code changes

## Key Differentiators

### AI-First Design

Every feature is designed so that AI agents can discover, invoke, and compose it with minimal friction. Operations can use Claude, Codex, or custom scripts as backends.

### Declarative Configuration

Pipelines, operations, and skills are data-driven. Define them as JSON/YAML, not imperative code. This makes them portable, version-controllable, and agent-accessible.

### Typed Pipeline Engine

The pipeline engine uses a directed acyclic graph (DAG) with typed nodes and edges. Each node has well-defined inputs and outputs, enabling safe composition.

### Extensible Architecture

- **Skills** — plug in new AI capabilities
- **Operations** — define custom check/fix tasks
- **Node Types** — folder, code-file, operation, output, compound, condition, github-project

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + Bun Workspaces |
| Frontend | React + Vite + TanStack Router + Refine |
| Backend | Hono (Node.js) |
| Database | PostgreSQL + Drizzle ORM |
| AI Agents | Claude CLI, Codex CLI |
| Type Safety | TypeScript + Zod schemas |
| Error Handling | neverthrow (Result types) |
| Testing | Vitest + Playwright |
