# Rules

Rules are policies that trigger pipeline enforcement automatically.

## Structure

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `description` | What this rule enforces |
| `pipelineId` | Pipeline to trigger |
| `trigger` | When to trigger |
| `tags` | Categorization labels |

## Creating a Rule

### Via the REST API

```sh
curl -X PUT http://localhost:9433/api/rules/pr-review \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "PR Review Rule",
    "description": "Run code review pipeline on every PR",
    "pipelineId": "code-review-pipeline",
    "tags": ["ci", "review"]
  }'
```

## Rule Triggers

Rules can be configured to trigger on various events, connecting external systems to pipeline execution.
