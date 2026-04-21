# tRPC API

Ordine uses [tRPC](https://trpc.io/) for type-safe client-server communication, primarily for real-time data that doesn't fit the REST CRUD pattern.

## Setup

The tRPC router is exposed alongside the REST API on the same Hono server.

## Available Procedures

### Jobs

```typescript
// Get traces for a job
trpc.jobs.getTraces.query({ jobId: "abc-123" })

// Get agent runs for a job
trpc.jobs.getAgentRuns.query({ jobId: "abc-123" })
```

### Settings

```typescript
// Get all settings
trpc.settings.getAll.query()

// Update a setting
trpc.settings.update.mutate({ key: "theme", value: "dark" })
```

## Client Usage

The frontend uses tRPC with React Query for automatic caching and refetching:

```typescript
import { trpcClient } from "@/integrations/trpc";

// In a component
const traces = await trpcClient.jobs.getTraces.query({ jobId });
```
