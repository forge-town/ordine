# Quick Start

Get Ordine running locally in minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.0+
- PostgreSQL (local or remote)

## Installation

```sh
# Clone the repository
git clone https://github.com/nicepkg/ordine.git
cd ordine

# Install dependencies
bun install
```

## Database Setup

Push the schema to your database:

```sh
cd apps/app
bun run db:push
```

::: tip
Make sure your PostgreSQL connection string is configured in the environment. See `.env.example` for the required variables.
:::

## Start Development

```sh
# From the root directory
bun dev
```

This starts all apps in parallel via Turborepo:

| App | URL | Description |
|-----|-----|-------------|
| `apps/app` | `http://localhost:5173` | Main web application |
| `apps/server` | `http://localhost:9433` | API server (Hono) |

## Create Your First Pipeline

1. Open the web app at `http://localhost:5173`
2. Navigate to **Operations** and create a new operation
3. Navigate to **Pipelines** and create a new pipeline
4. Add nodes to the pipeline canvas and connect them
5. Click **Run** to execute

## CLI Usage

Ordine also provides a CLI for headless operation:

```sh
cd apps/cli
bun run src/index.ts --help
```

## What's Next?

- Learn about [Core Concepts](/guide/core-concepts) to understand the entity model
- Explore [Pipelines](/guide/pipelines) for composing multi-step workflows
- Read about the [Architecture](/architecture/overview) for deeper technical understanding
