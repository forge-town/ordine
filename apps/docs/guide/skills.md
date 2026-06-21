# Skills

Skills are pluggable AI agent capabilities that power operation execution.

## Structure

| Field | Description |
|-------|-------------|
| `id` | Unique identifier (slug format) |
| `label` | Human-readable name |
| `description` | What this skill does |
| `category` | Organization category |

## How Skills Work

When an operation has `executor.agentMode: "skill"`, the skill executor:

1. Looks up the skill by `skillId`
2. Builds a system prompt from the skill's description
3. Sends the system prompt + user input to the configured AI agent
4. Returns the agent's structured output

## Creating a Skill

### Via the REST API

```sh
curl -X PUT http://localhost:9433/api/skills/code-review \
  -H 'Content-Type: application/json' \
  -d '{
    "label": "Code Review",
    "description": "Review code for quality, patterns, and potential issues. Output a structured report with findings.",
    "category": "analysis"
  }'
```

## Skill Categories

| Category | Description |
|----------|-------------|
| `analysis` | Code analysis and review |
| `generation` | Code generation |
| `transformation` | Code transformation and refactoring |
| `documentation` | Documentation generation |

## Built-in Skills

Ordine comes with a set of community skills via the skills sync mechanism:

```sh
# Sync community skills
bun run sync-skills
```

Skills are stored in the `skills/` directory at the repository root, each with a `SKILL.md` file describing its capabilities.

## Using Skills in Operations

```json
{
  "id": "review-code",
  "name": "AI Code Review",
  "executor": {
    "type": "agent",
    "agentMode": "skill",
    "agent": "local-claude",
    "skillId": "code-review",
    "allowedTools": ["Read", "Glob", "Grep"]
  }
}
```
