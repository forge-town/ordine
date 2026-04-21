# Best Practices

Best Practices capture your team's coding standards as structured, machine-verifiable checklists.

## Structure

A Best Practice consists of:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (slug format) |
| `title` | Human-readable name |
| `content` | Detailed description in Markdown |
| `tags` | Categorization labels |

## Creating a Best Practice

### Via the Web UI

1. Navigate to **Best Practices** in the sidebar
2. Click **Create New**
3. Fill in the title, content, and tags
4. Save

### Via the REST API

```sh
curl -X PUT http://localhost:9433/api/best-practices/my-practice \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Component File Structure",
    "content": "Each React component should have its own directory...",
    "tags": ["react", "structure"]
  }'
```

## Using Best Practices in Operations

Best Practices are referenced by operations. When an operation has `executor.type: "rule-check"`, it evaluates code against the best practice's checklist.

```json
{
  "id": "check-component-structure",
  "name": "Check Component Structure",
  "executor": {
    "type": "rule-check",
    "bestPracticeId": "my-practice"
  }
}
```
