# Architecture Overview

Ordine follows a clean, layered architecture with strict separation of concerns.

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   Apps Layer                      │
│  ┌─────────┐  ┌────────┐  ┌─────┐  ┌──────────┐│
│  │  app    │  │ server │  │ cli │  │ scripts  ││
│  │ (React) │  │ (Hono) │  │     │  │          ││
│  └────┬────┘  └───┬────┘  └──┬──┘  └──────────┘│
└───────┼───────────┼──────────┼──────────────────┘
        │           │          │
┌───────┼───────────┼──────────┼──────────────────┐
│       ▼           ▼          ▼  Packages Layer   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │   ui     │ │ services │ │  pipeline-engine │ │
│  └──────────┘ └────┬─────┘ └────────┬─────────┘ │
│                    │                │            │
│               ┌────▼────┐    ┌─────▼──────┐     │
│               │  models │    │agent-engine │     │
│               └────┬────┘    └─────┬──────┘     │
│                    │               │            │
│               ┌────▼────┐    ┌─────▼──────┐     │
│               │   db    │    │   agent    │     │
│               └────┬────┘    └────────────┘     │
│                    │                            │
│               ┌────▼─────┐                      │
│               │db-schema │                      │
│               └──────────┘                      │
│                                                 │
│  ┌────────┐ ┌────────┐ ┌───────┐ ┌───────────┐ │
│  │schemas │ │  obs   │ │logger │ │   utils   │ │
│  └────────┘ └────────┘ └───────┘ └───────────┘ │
└─────────────────────────────────────────────────┘
```

## Design Principles

### 1. AI-First Development

Every feature is designed for AI accessibility. Interfaces are narrow, typed, and discoverable. Configuration is declarative over imperative.

### 2. Ontological Purity

Each module reflects its true nature:
- **DAO** — talks to the database and nothing else
- **Service** — orchestrates business logic; never touches SQL
- **Pipeline** — a directed graph of typed nodes; no inline business logic
- **Types** — derived from Zod schemas (`z.infer`), never hand-duplicated

### 3. Error Handling

**Zero `try-catch`** in the codebase. All errors use [neverthrow](https://github.com/supermacro/neverthrow):
- `Result<T, E>` and `ResultAsync<T, E>` everywhere
- Errors are values, not exceptions
- Callers must handle errors explicitly

### 4. Single Responsibility

- One React component per `.tsx` file
- One DAO per table
- One Service per domain
- Barrel exports (`index.ts`) only re-export

## Data Flow

```
User Action → REST/tRPC API → Service → DAO → Database
                                ↓
                         Pipeline Engine
                                ↓
                         Agent Engine → Claude/Codex CLI
                                ↓
                         Job Traces → Database
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Package Manager | Bun |
| Monorepo | Turborepo |
| Frontend | React 19 + Vite + TanStack Router |
| UI Components | shadcn/ui (Radix + Tailwind) |
| State Management | Zustand |
| Data Fetching | Refine + tRPC |
| Backend | Hono |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod |
| Error Handling | neverthrow |
| Testing | Vitest + Playwright |
| Linting | oxlint |
| AI Agents | Claude CLI, Codex CLI |
