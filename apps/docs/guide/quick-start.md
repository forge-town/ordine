# Quick Start

Get Ordine running locally in minutes.

## Quick Install (recommended)

The fastest way to run Ordine — no external database or configuration needed:

```sh
npm create @ordine -- --yes
```

This starts Ordine at `http://localhost:9430` with embedded PostgreSQL (PGLite), automatically runs database migrations, and enables local mode (single-user, no login required).

To stop, press `Ctrl+C`.

For interactive mode (choose data directory, port, etc.):

```sh
npm create @ordine
```

## Develop from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.0+

### Installation

```sh
# Clone the repository
git clone https://github.com/forge-town/ordine.git
cd ordine

# Install dependencies
bun install
```

### Database Setup

Create local env files first:

```sh
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env
```

**Pick one database option:**

- **PGLite (embedded, no external PostgreSQL required):**
  ```sh
  # In both .env files, set:
  PGLITE_DATA_DIR=./.pglite
  ```

- **PostgreSQL (external):**
  ```sh
  # In both .env files, set:
  DATABASE_URL=postgresql://postgres:<password>@localhost:5432/ordine
  ```

Then push the schema:

```sh
cd apps/app
bun run db:push
```

::: tip
PGLite is the easiest option for local development — no need to install or run a separate PostgreSQL server. Data is stored in the directory you specify.
:::

### Start Development

```sh
# From the root directory
bun dev
```

This starts all apps in parallel via Turborepo:

| App | URL | Description |
|-----|-----|-------------|
| `apps/app` | `http://localhost:9430` | Main web application |
| `apps/server` | `http://localhost:9433` | API server (Hono) |

### Local Mode

For self-hosted single-machine use, enable Local Mode to skip the login page:

```sh
# In apps/app/.env
ORDINE_LOCAL_MODE=true
```

A default local user is auto-created and logged in on first visit. ⚠️ Do NOT enable in shared or production environments.

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
