# Quick Start

Get Ordine running locally in minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.0+
- PostgreSQL (local or remote)

## Installation

```sh
# Clone the repository
git clone https://github.com/forge-town/ordine.git
cd ordine

# Install dependencies
bun install
```

## Database Setup

Create local env files first:

```sh
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env
```

Set the same `DATABASE_URL` in both files, then push the schema to your database:

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
| `apps/app` | `http://localhost:9430` | Main web application |
| `apps/server` | `http://localhost:9433` | API server (Hono) |

## Create Your First Pipeline

1. Open the web app at `http://localhost:9430`
2. Navigate to **Operations** and create a new operation
3. Navigate to **Pipelines** and create a new pipeline
4. Add nodes to the pipeline canvas and connect them
5. Click **Run** to execute

## Contribution Policy

External contributions and public security intake are paused until beta.

## CLI Usage

Ordine also provides a CLI for headless operation:

```sh
cd apps/cli
bun run src/index.ts --help
```

## What's Next?

- Learn about [Core Concepts](/guide/core-concepts) to understand the entity model
- Browse the [Skills](/skills/) to see what AI agents can do with Ordine
