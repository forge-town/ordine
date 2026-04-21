# AGENTS.md

> Ordine — an AI-first pipeline orchestration platform for code quality automation

## Core Principles

### 1. AI-First Development

All implementation decisions must prioritize **AI accessibility and integration**:

- Every feature should be designed so that an AI agent can discover, invoke, and compose it with minimal friction
- Prefer declarative configuration over imperative code — pipelines, operations, and skills are data-driven
- Keep interfaces narrow and typed so agents can reason about inputs/outputs without ambiguity
- When choosing between two equally valid approaches, pick the one that is easier for an agent to automate

### 2. Ontological Purity

Code must be **ontologically sound** — every entity, relationship, and transformation should reflect its true nature:

- A DAO is a DAO; it talks to the database and nothing else
- A Service orchestrates business logic; it never touches SQL directly
- A Pipeline is a directed graph of typed nodes; it never contains inline business logic
- Types are derived from schemas (`z.infer`), never hand-duplicated
- Naming must reflect essence: if it's a check, call it `check`; if it fixes, call it `fix`

### 3. Backend-First Protocol

Any feature involving frontend + backend must follow strict ordering:

1. **Backend** — implement API / tRPC route / DAO / Service
2. **Backend test** — verify the interface returns correct data
3. **Frontend** — build UI against the verified interface
4. **Frontend test** — confirm end-to-end behavior

Skipping or reordering is a protocol violation

### 4. Zero-Tolerance Error Handling

- **Absolutely no `try-catch`, `try-finally`, or `.catch()` anywhere** in the codebase
- Use `neverthrow` exclusively: `Result<T, E>`, `ResultAsync<T, E>`, `Result.fromThrowable()`, `ResultAsync.fromPromise()`
- Errors are values, not exceptions; callers must handle them explicitly

### 5. Single Responsibility Per File

- One React component per `.tsx` file
- One DAO per table
- One Service per domain
- Barrel exports (`index.ts`) only re-export; no business logic

### 6. Functional Purity

- Prefer pure functions and immutable data
- State changes through Zustand stores with slice pattern, never through mutable globals
- Side effects isolated at the boundary; core logic remains referentially transparent
- No implicit dependencies — everything is explicit, injectable, and testable
