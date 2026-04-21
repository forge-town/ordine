# `apps/app`

This is the main open-source Ordine application in this monorepo.

It provides the primary UI for defining operations, composing pipelines, managing jobs, and working with the built-in code quality workflow.

## Local Development

From the repository root:

```sh
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env

# Set DATABASE_URL in both env files first
cd apps/app && bun run db:push && cd ../..
bun dev
```

The app runs on `http://localhost:9430`.

## Useful Commands

```sh
bun run dev
bun run build
bun run test
bun run lint
bun run db:push
```

## Notes

- `apps/app` depends on the API server in `apps/server`
- The root [README](../../README.md) is the canonical setup guide for the public repository
