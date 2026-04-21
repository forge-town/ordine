# Operations

Operations are atomic coding tasks with configurable executor backends.

## Structure

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Human-readable name |
| `description` | What this operation does |
| `executor` | Executor configuration |
| `tags` | Categorization labels |

## Executor Configuration

### Agent Executor

Uses an AI agent (Claude or Codex) to execute the operation.

```json
{
  "executor": {
    "type": "agent",
    "agentMode": "skill",
    "agent": "local-claude",
    "skillId": "my-skill",
    "allowedTools": ["Read", "Glob", "Grep"],
    "promptMode": "code"
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | `"agent"` |
| `agentMode` | `"skill"` (uses a skill) or `"prompt"` (direct prompt) |
| `agent` | `"local-claude"` or `"codex"` |
| `skillId` | Skill ID to use (when `agentMode: "skill"`) |
| `prompt` | Direct prompt text (when `agentMode: "prompt"`) |
| `allowedTools` | Tools the agent can use |
| `promptMode` | `"code"` (default) or `"research"` |
| `writeEnabled` | Allow the agent to modify files |

### Script Executor

Runs a custom script.

```json
{
  "executor": {
    "type": "script",
    "command": "eslint --format json ."
  }
}
```

### Rule-Check Executor

Validates code against a best practice.

```json
{
  "executor": {
    "type": "rule-check",
    "bestPracticeId": "my-practice"
  }
}
```

## Creating an Operation

### Via the REST API

```sh
curl -X PUT http://localhost:9433/api/operations/lint-check \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Lint Check",
    "description": "Run linting on the input files",
    "executor": {
      "type": "agent",
      "agentMode": "prompt",
      "agent": "local-claude",
      "prompt": "Analyze the provided code for style issues."
    },
    "tags": ["lint", "quality"]
  }'
```

## Agent Tools

When using agent executors, you can restrict which tools the agent has access to:

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Write/create files |
| `Edit` | Edit existing files |
| `Glob` | List files by pattern |
| `Grep` | Search file contents |
| `Bash` | Execute shell commands |
| `MultiEdit` | Edit multiple files |
