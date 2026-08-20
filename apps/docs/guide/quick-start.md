# Quick Start

Get Ordine running locally in minutes.

## Quick Install (recommended)

The fastest way to run Ordine with a local Docker PostgreSQL database:

```sh
docker run -d --name ordine-postgres -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ordine \
  -v ordine-postgres-data:/var/lib/postgresql/data postgres:16-alpine
until docker exec ordine-postgres pg_isready -U postgres -d ordine >/dev/null 2>&1; do sleep 1; done
npm create @ordine -- --yes
```

This starts Ordine at `http://localhost:9430` with Docker PostgreSQL, automatically runs database migrations, and enables local mode (single-user, no login required).

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

**Database — Docker PostgreSQL:**

```sh
bun run db:up
# In both .env files, set:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ordine
```

Then push the schema:

```sh
cd apps/app
bun run db:push
```

### Start Development

```sh
# From the root directory
bun dev
```

This starts all apps in parallel via Turborepo:

| App           | URL                     | Description          |
| ------------- | ----------------------- | -------------------- |
| `apps/app`    | `http://localhost:9430` | Main web application |
| `apps/server` | `http://localhost:9433` | API server (Hono)    |

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
