# What is Ordine?

::: warning 🚧 Preview
Ordine is currently in **Preview** stage. APIs and features may change. We welcome feedback and contributions!
:::

Ordine is an **AI Agent-first work scheduling framework**. It provides a universal work scheduling framework for defining, composing, and executing automated workflows — powered by AI agents and scripts.

Code quality automation is Ordine's first and flagship use case, delivered as a built-in plugin. Over time, domain-specific capabilities (code review, security scanning, documentation generation, etc.) will be fully extracted into plugins, leaving Ordine as a pure scheduling core.

## The Problem

Automation workflows are everywhere — code review, CI/CD, data processing, content generation — yet each domain reinvents its own scheduling layer. Teams end up with fragmented tools that can't compose, share context, or leverage AI agents effectively.

## The Solution

Ordine provides a single scheduling layer that:

1. **Define** operations — atomic tasks executed by AI agents, scripts, or plugins
2. **Compose** operations into multi-step pipelines (DAG execution)
3. **Extend** capabilities through a plugin system
4. **Automate** execution through rules that trigger pipelines on events

### Code Quality Plugin (Built-in)

The built-in code quality plugin adds:

- **Best Practices** — machine-readable coding standards with checklists
- **Code-aware Operations** — check/fix code using AI agents or linters
- **Rule Triggers** — automatically run pipelines on code changes

This plugin demonstrates Ordine's extensibility model: domain knowledge lives in plugins, scheduling lives in the core.

## Key Differentiators

### AI Agent-First Design

Every feature is designed so that AI agents can discover, invoke, and compose it with minimal friction. Operations can use Claude, Codex, or custom scripts as backends.

### Declarative Configuration

Pipelines, operations, and skills are data-driven. Define them as JSON/YAML, not imperative code. This makes them portable, version-controllable, and agent-accessible.

### Typed Pipeline Engine

The pipeline engine uses a directed acyclic graph (DAG) with typed nodes and edges. Each node has well-defined inputs and outputs, enabling safe composition.

### Extensible Architecture

- **Plugins** — encapsulate domain-specific knowledge and capabilities
- **Skills** — plug in new AI capabilities
- **Operations** — define custom tasks with any executor backend
- **Node Types** — folder, code-file, operation, output, compound, condition, github-project

### Plugin System

Domain logic is progressively migrating into plugins. The core engine provides:

- Pipeline DAG scheduling
- Agent dispatching
- Entity management (operations, skills, rules, jobs)
- UI canvas and API

Plugins provide domain-specific entities, operations, and UI extensions. The code quality plugin is the first — more will follow.
