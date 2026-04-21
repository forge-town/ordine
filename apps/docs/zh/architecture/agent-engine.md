# Agent 引擎

Agent 引擎（`packages/agent-engine`）负责将操作分发到 AI agent 后端执行。

## 接口

### AgentRunOptions

```typescript
interface AgentRunOptions {
  model: string;           // "claude" | "codex"
  mode: "direct";          // 执行模式（仅支持 direct）
  prompt: string;          // 发送给 agent 的提示词
  workingDirectory: string; // 工作目录
  tools?: string[];        // 可用工具列表
}
```

### AgentRunResult

```typescript
interface AgentRunResult {
  output: string;    // Agent 输出
  exitCode: number;  // 退出码
}
```

## 支持的后端

| 后端 | 说明 |
|------|------|
| Claude CLI | Anthropic Claude，通过本地 CLI 调用 |
| Codex CLI | OpenAI Codex，通过本地 CLI 调用 |

## 使用示例

```typescript
import { runAgent } from "@ordine/agent-engine";

const result = await runAgent({
  model: "claude",
  mode: "direct",
  prompt: "审查以下代码的安全问题...",
  workingDirectory: "/path/to/project",
});

if (result.isOk()) {
  console.log(result.value.output);
}
```

## 集成

```
服务层 (skillExecutor / promptExecutor)
    │
    ▼
Agent 引擎 (agentEngine.ts)
    │
    ├── runLocalClaudeDirect()  ← Claude CLI
    └── runCodexDirect()        ← Codex CLI
```

Agent 引擎通过驱动函数（Driver Function）模式将执行委托给具体的后端。驱动函数注册在 `DRIVERS` 映射中，按 model 名称查找。

## Direct 模式

Direct 模式通过子进程直接调用 CLI 工具，捕获标准输出和退出码。这是唯一支持的执行模式，提供最简单可靠的 agent 交互方式。
