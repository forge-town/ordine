# Pipeline Engine

The pipeline engine (`packages/pipeline-engine`) is the core execution framework that processes directed acyclic graphs (DAGs) of typed nodes.

## Design

The engine is intentionally **dependency-free** (beyond Zod for validation). It receives all external capabilities through a dependency injection interface (`PipelineEngineDeps`).

## Execution Flow

```
Pipeline.run()
    │
    ├── buildExecutionLevels(nodes, edges)  → topological sort
    │
    ├── Level 0: parallel node processing
    │       ├── FolderNode.process()
    │       └── CodeFileNode.process()
    │
    ├── Level 1: parallel node processing
    │       └── OperationNode.process()
    │               ├── agent executor → skillExecutor / promptExecutor
    │               ├── script executor
    │               └── rule-check executor
    │
    └── Level 2: output node processing
            └── OutputLocalPathNode.process()
```

## Node Processing

Each node type implements a `process()` function that:

1. Receives a `NodeContext` with input data, dependencies, and shared state
2. Performs its work (read files, execute operations, write output)
3. Stores its output in the shared `nodeOutputs` map
4. Returns success/failure result

### NodeContext

```typescript
interface NodeContext {
  node: PipelineNode;          // The node definition
  input: NodeCtx;              // { inputPath, content } from parent nodes
  deps: PipelineEngineDeps;    // Injected dependencies
  nodeOutputs: Map<string, NodeCtx>;  // Shared output store
  tempDirs: string[];          // Temp directories for cleanup
  jobId: string;               // Associated job ID
}
```

### NodeCtx (Data Flow)

```typescript
interface NodeCtx {
  inputPath: string;   // File or directory path
  content: string;     // Text content
}
```

## Dependency Injection

The engine receives all external capabilities through `PipelineEngineDeps`:

```typescript
interface PipelineEngineDeps {
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, Error>;
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runScript: (opts: RunScriptOptions) => ResultAsync<string, Error>;
  // ... other capabilities
}
```

This design enables:
- **Testability** — all deps can be mocked
- **Flexibility** — swap implementations without changing the engine
- **AI-friendliness** — clear, typed interfaces

## Topological Sort

The engine uses Kahn's algorithm to:

1. Compute in-degree for each node
2. Group nodes with zero in-degree into levels
3. Process each level in order, with parallel execution within levels

Cycle detection is built-in — circular dependencies produce a `CycleDetectedError`.

## Error Handling

All operations return `Result` types (neverthrow). Pipeline execution short-circuits on the first error at any level, with proper cleanup of temporary directories.
