# Core Concepts

Ordine's entity model is designed around composability. Small, well-typed pieces combine into powerful automation workflows.

## Entity Hierarchy

```
Best Practice ──► Operation ──► Pipeline ──► Rule
     │                │             │
     └── Checklist    └── Skill     └── Job (execution)
```

## Best Practices

A **Best Practice** captures a coding standard with an associated checklist. Each checklist item can be verified by a script check or an LLM-powered analysis.

- Defined as structured data (title, description, checklist items)
- Reusable across multiple operations
- Version-controlled alongside your codebase

## Operations

An **Operation** is an atomic coding task with a configured executor backend.

```
Operation = Executor Config + Input Schema + Output Schema
```

Executor types:
- **`agent`** — AI agent (Claude or Codex) with configurable system prompt and tools
- **`script`** — Custom script execution
- **`rule-check`** — Policy validation

Agent modes:
- **`skill`** — Uses a registered skill for structured AI execution
- **`prompt`** — Direct prompt-based AI execution

## Pipelines

A **Pipeline** is a directed acyclic graph (DAG) of typed nodes connected by edges.

### Node Types

| Type | Description |
|------|-------------|
| `folder` | Directory input — reads a folder tree |
| `code-file` | Single file input |
| `operation` | Executes an operation |
| `output-local-path` | Writes output to a local directory |
| `compound` | Groups multiple nodes |
| `condition` | Conditional branching |
| `github-project` | GitHub repository input |

### Execution Model

1. Nodes are organized into **execution levels** (topological sort)
2. Nodes at the same level run **in parallel**
3. Data flows along edges from parent to child nodes
4. Each node produces a `NodeCtx` (content + inputPath) for downstream consumers

## Skills

A **Skill** is a pluggable AI agent capability. Skills define:

- A unique ID and label
- A description of what the skill does
- A category for organization

Skills are referenced by operations to power agent-based execution.

## Rules

A **Rule** is a policy that can trigger pipeline execution automatically. Rules connect events (e.g., code changes) to pipeline enforcement.

## Jobs

A **Job** tracks the execution of a pipeline run. It includes:

- Status tracking (queued → running → done/failed)
- Real-time traces and logs
- Structured output (JSON result)
- Duration and timing metadata
