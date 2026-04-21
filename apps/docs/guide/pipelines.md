# Pipelines

Pipelines chain operations into multi-step DAG workflows with typed nodes and edges.

## Structure

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `description` | What this pipeline does |
| `nodes` | Array of pipeline nodes |
| `edges` | Array of edges connecting nodes |
| `tags` | Categorization labels |

## Node Types

### Folder Node

Provides a directory tree as input to downstream nodes.

```json
{
  "id": "folder-1",
  "type": "folder",
  "data": {
    "label": "Source Code",
    "folderPath": "/path/to/project"
  }
}
```

### Code File Node

Provides a single file as input.

```json
{
  "id": "file-1",
  "type": "code-file",
  "data": {
    "label": "README",
    "filePath": "README.md"
  }
}
```

### Operation Node

Executes a registered operation.

```json
{
  "id": "op-1",
  "type": "operation",
  "data": {
    "label": "Lint Check",
    "operationId": "lint-check"
  }
}
```

### Output Local Path Node

Writes pipeline output to a local directory.

```json
{
  "id": "output-1",
  "type": "output-local-path",
  "data": {
    "label": "Results",
    "localPath": ".ordine/results"
  }
}
```

## Edges

Edges define data flow between nodes:

```json
{
  "id": "e1",
  "source": "file-1",
  "target": "op-1"
}
```

## Execution Model

```
Level 0:  [folder-1]  [file-1]     ← Input nodes (parallel)
              │            │
Level 1:  [op-check]  [op-lint]    ← Operations (parallel)
              │            │
Level 2:       [op-merge]           ← Merge step
                   │
Level 3:      [output-1]            ← Output
```

1. The pipeline engine performs a **topological sort** on the DAG
2. Nodes are grouped into **execution levels**
3. Nodes at the same level run **in parallel**
4. Each node receives input from its parent nodes via `NodeCtx`
5. Output flows to child nodes along edges

## Creating a Pipeline

### Via the REST API

```sh
curl -X PUT http://localhost:9433/api/pipelines/my-pipeline \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Code Review Pipeline",
    "description": "Automated code review with linting and AI analysis",
    "nodes": [...],
    "edges": [...],
    "tags": ["review"]
  }'
```

### Via the Canvas UI

1. Navigate to **Pipelines** and create a new pipeline
2. Click **Edit in Canvas** to open the visual editor
3. Drag nodes from the palette and connect them with edges
4. Save and run

## Running a Pipeline

### Via the Web UI

1. Open a pipeline detail page
2. Optionally set an input path
3. Click **Run**
4. Monitor progress in real-time via the log viewer

### Via the REST API

```sh
curl -X POST http://localhost:9433/api/pipelines/my-pipeline/run \
  -H 'Content-Type: application/json' \
  -d '{"inputPath": "/path/to/project"}'
```

The response returns a `jobId` for tracking:

```json
{ "jobId": "abc-123-..." }
```
