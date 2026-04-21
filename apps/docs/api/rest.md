# REST API

The Ordine server exposes a REST API on port `9433` by default. All endpoints are prefixed with `/api/`.

## Base URL

```
http://localhost:9433/api
```

## Resources

### Pipelines

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pipelines` | List all pipelines |
| `POST` | `/pipelines` | Create a pipeline |
| `PUT` | `/pipelines` | Upsert a pipeline |
| `GET` | `/pipelines/:id` | Get a pipeline by ID |
| `PATCH` | `/pipelines/:id` | Update a pipeline |
| `DELETE` | `/pipelines/:id` | Delete a pipeline |
| `POST` | `/pipelines/:id/run` | Run a pipeline |

#### Run Pipeline

```sh
curl -X POST http://localhost:9433/api/pipelines/my-pipeline/run \
  -H 'Content-Type: application/json' \
  -d '{"inputPath": "/path/to/project"}'
```

Response:
```json
{ "jobId": "d1612c1b-cd83-4936-b3db-8777847b1871" }
```

### Operations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/operations` | List all operations |
| `POST` | `/operations` | Create an operation |
| `PUT` | `/operations` | Upsert an operation |
| `GET` | `/operations/:id` | Get an operation by ID |
| `PATCH` | `/operations/:id` | Update an operation |
| `DELETE` | `/operations/:id` | Delete an operation |

### Skills

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/skills` | List all skills |
| `POST` | `/skills` | Create a skill |
| `GET` | `/skills/:id` | Get a skill by ID |
| `PATCH` | `/skills/:id` | Update a skill |
| `DELETE` | `/skills/:id` | Delete a skill |

### Best Practices

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/best-practices` | List all best practices |
| `PUT` | `/best-practices` | Upsert a best practice |
| `DELETE` | `/best-practices/:id` | Delete a best practice |

### Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/rules` | List all rules |
| `PUT` | `/rules` | Upsert a rule |
| `DELETE` | `/rules/:id` | Delete a rule |

### Recipes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/recipes` | List all recipes |
| `POST` | `/recipes` | Create a recipe |
| `PUT` | `/recipes` | Upsert a recipe |
| `DELETE` | `/recipes/:id` | Delete a recipe |

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/jobs` | List all jobs |
| `GET` | `/jobs/:id` | Get a job by ID |
| `GET` | `/jobs/:id/traces` | Get traces for a job |
| `DELETE` | `/jobs/:id` | Delete a job |

### Filesystem

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/filesystem` | Browse filesystem |

### Code Snippets

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/code-snippets` | List code snippets |
| `PUT` | `/code-snippets` | Upsert a code snippet |
| `DELETE` | `/code-snippets` | Delete a code snippet |

### Checklist Items

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/checklist-items` | List checklist items |
| `PUT` | `/checklist-items` | Upsert a checklist item |
| `DELETE` | `/checklist-items` | Delete a checklist item |

## Common Patterns

### Upsert

Most resources support `PUT` for upsert — the request body includes the `id` field. If the ID exists, the record is updated; otherwise, it's created.

### List Filtering

List endpoints support query parameters for filtering:

```sh
# Filter by Refine conventions
GET /api/pipelines?_sort=updatedAt&_order=desc&_start=0&_end=10
```

### Error Responses

Errors are returned as JSON:

```json
{
  "error": "Pipeline not found",
  "statusCode": 404
}
```
