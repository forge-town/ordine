# Core Concepts

Ordine is built around a small set of composable primitives. Understanding these concepts is key to building effective automation workflows.

## Concept Map

```
Object ──► Operation ──► Pipeline ──► Rule
               │             │
               └── Skill     └── Job (execution)
```

## Objects

**Objects** are the things that pipelines operate on — the inputs that flow through the graph. Ordine supports several object types out of the box:

| Object Type | Description |
|-------------|-------------|
| `folder` | A directory tree — all files under a path |
| `code-file` | A single source file |
| `github-project` | A GitHub repository |

Objects are the entry points of a pipeline. They appear as source nodes in the DAG and their content flows downstream to operations for processing.

## Operations

An **Operation** is the fundamental building block — an atomic task with a configured executor backend.

```
Operation = Executor Config + Input Schema + Output Schema
```

Executor types:
- **`agent`** — AI agent (Claude or Codex) with configurable system prompt and tools
- **`script`** — Custom script execution

Agent modes:
- **`skill`** — Uses a registered skill for structured AI execution
- **`prompt`** — Direct prompt-based AI execution

## Pipelines

A **Pipeline** composes operations into a multi-step workflow, represented as a directed acyclic graph (DAG) of typed nodes connected by edges.

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

A **Skill** is a pluggable AI agent capability that operations can reference. Skills define:

- A unique ID and label
- A description of what the skill does
- A category for organization

Skills decouple "what the agent knows" from "what the operation does", making both independently reusable.

## Rules

A **Rule** defines when and how pipelines are triggered automatically. Rules connect events (e.g., code changes, schedules, manual triggers) to pipeline execution.

## Jobs

A **Job** tracks the execution of a pipeline run. It includes:

- Status tracking (queued → running → done/failed)
- Real-time traces and logs
- Structured output (JSON result)
- Duration and timing metadata

## Plugins

**Plugins** extend Ordine with domain-specific capabilities. A plugin can introduce:

- New entity types (e.g., Best Practices with checklists)
- Specialized operations
- UI extensions
- Custom triggers

The built-in code quality plugin is the first example of this model.
