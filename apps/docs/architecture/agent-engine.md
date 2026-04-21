# Agent Engine

The agent engine (`packages/agent-engine`) dispatches operations to AI agent backends.

## Design

The engine is a thin dispatch layer that routes execution to the appropriate AI backend based on configuration.

```typescript
interface AgentRunOptions {
  agent: "local-claude" | "codex";
  mode: "direct";
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  allowedTools?: readonly ToolName[];
  onProgress?: (msg: string) => Promise<void> | void;
}

interface AgentRunResult {
  text: string;
  events: ClaudeStreamEvent[];
}
```

## Supported Backends

### Local Claude

Spawns `claude -p --verbose` as a child process. Supports:
- System prompt and user prompt
- Tool restrictions (Read, Write, Edit, Glob, Grep, Bash, etc.)
- Streaming progress via `onProgress` callback
- Structured event output (cost, duration, turns)

### Codex

Spawns the Codex CLI. Returns text output.

## Execution

```typescript
import { agentEngine } from "@repo/agent-engine";

const result = await agentEngine.run({
  agent: "local-claude",
  mode: "direct",
  systemPrompt: "You are a code reviewer.",
  userPrompt: "Review this code:\n\n" + code,
  cwd: "/path/to/project",
  allowedTools: ["Read", "Glob", "Grep"],
});

console.log(result.text);    // Agent's text output
console.log(result.events);  // Structured events (cost, duration, etc.)
```

## Integration with Pipeline Engine

The agent engine is used by the `skillExecutor` and `promptExecutor` services, which are injected into the pipeline engine as dependencies:

```
Pipeline Engine
    └── deps.runSkill()
            └── skillExecutor.run()
                    └── agentEngine.run()
                            └── runClaude() / runCodex()
```
