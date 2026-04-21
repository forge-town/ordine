# Monorepo Structure

Ordine uses **Turborepo + Bun Workspaces** to manage a monorepo with clear separation between apps and shared packages.

## Directory Layout

```
ordine/
├── apps/
│   ├── app/          # Main web application (React + Vite)
│   ├── cli/          # Command-line interface
│   ├── docs/         # Documentation (VitePress)
│   ├── scripts/      # Build and utility scripts
│   ├── server/       # API server (Hono)
│   └── web/          # Marketing site (Next.js)
├── packages/
│   ├── agent/        # AI agent drivers (Claude, Codex)
│   ├── agent-engine/ # Agent dispatch engine
│   ├── db/           # Database connection
│   ├── db-schema/    # Drizzle schema definitions
│   ├── logger/       # Structured logging (pino)
│   ├── models/       # DAOs and data access
│   ├── obs/          # Observability and tracing
│   ├── pipeline-engine/ # DAG pipeline execution engine
│   ├── plugin/       # Plugin system
│   ├── plugins/      # Built-in plugins
│   ├── schemas/      # Shared Zod schemas
│   ├── services/     # Business logic services
│   ├── ui/           # Shared UI components (shadcn)
│   └── utils/        # Shared utility functions
├── skills/           # AI skill definitions (SKILL.md)
└── .ordine/          # Self-bootstrapping config
```

## Apps

### `apps/app`

The main web application built with React, Vite, and TanStack Router. Uses Refine for CRUD operations and tRPC for real-time data.

### `apps/server`

REST + tRPC API server built with Hono. Runs on port 9433 by default.

### `apps/cli`

Command-line interface for headless pipeline execution and management.

### `apps/web`

Marketing/landing page built with Next.js.

## Key Packages

### `packages/pipeline-engine`

The core DAG execution engine. Handles node processing, topological sorting, parallel execution, and error propagation. No external dependencies beyond Zod.

### `packages/agent-engine`

Dispatches operations to AI agent backends. Currently supports:
- `local-claude` → Claude CLI (`claude -p`)
- `codex` → Codex CLI

### `packages/agent`

Low-level drivers for interacting with AI CLIs:
- `runClaude()` — spawns `claude -p --verbose` as a child process
- `runCodex()` — spawns Codex CLI

### `packages/services`

Business logic orchestration layer. Key services:
- `pipelineRunnerService` — runs pipelines, manages jobs
- `skillExecutor` — executes skills via agent engine
- `promptExecutor` — executes direct prompts via agent engine

### `packages/models`

Data access objects (DAOs) for each database table. Uses Drizzle ORM with strict typing.

### `packages/db-schema`

Drizzle schema definitions for all database tables. Source of truth for TypeScript types.

## Dependency Graph

```
apps/app     → ui, schemas
apps/server  → services, models, db
apps/cli     → services, schemas

services     → models, agent-engine, pipeline-engine, obs
pipeline-engine → schemas
agent-engine → agent
models       → db, db-schema
db           → db-schema
```

## Build & Dev

```sh
# Development (all apps)
bun dev

# Build all packages
bun run build

# Run all tests
bun test

# Type checking
bun run check-types

# Linting
bun run lint
```
