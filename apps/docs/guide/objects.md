# Objects

**Objects** are the things that pipelines operate on — the inputs that flow through the graph.

## Object Types

### Folder

A directory tree. The pipeline reads all files under the specified path and passes their content downstream.

```json
{
  "type": "folder",
  "data": { "path": "./src" }
}
```

Use cases:
- Scan an entire project directory
- Process all files matching a pattern
- Feed a codebase to an AI agent for review

### Code File

A single source file. Use when you want to target a specific file for processing.

```json
{
  "type": "code-file",
  "data": { "path": "./src/index.ts" }
}
```

Use cases:
- Analyze a single configuration file
- Process a specific module
- Target a known problem file

### GitHub Project

A GitHub repository. The pipeline clones or references the repository and passes its content downstream.

```json
{
  "type": "github-project",
  "data": { "owner": "nicepkg", "repo": "ordine" }
}
```

Use cases:
- Review external repositories
- Cross-project analysis
- Dependency auditing

## How Objects Flow

Objects are source nodes in the pipeline DAG. They have no incoming edges — only outgoing ones. Their content is packaged as `NodeCtx` and flows to downstream operations:

```
[folder: ./src] ──► [operation: review] ──► [output: ./results]
```

Multiple objects can feed into the same operation, and their content is merged before processing.

## Custom Objects (via Plugins)

Plugins can introduce new object types. For example, a documentation plugin might add a `wiki-page` object type, or a CI plugin might add a `pull-request` object type.
