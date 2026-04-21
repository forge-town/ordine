# 架构总览

Ordine 采用分层架构设计，每一层都有明确的职责和接口。

## 架构图

```
┌─────────────────────────────────────────────┐
│              前端 (apps/app)                  │
│  React + Vite + TanStack Router + Refine     │
└──────────────────────┬──────────────────────┘
                       │ HTTP / tRPC
┌──────────────────────▼──────────────────────┐
│             API 服务器 (apps/server)          │
│              Hono + tRPC                     │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│           服务层 (packages/services)          │
│  pipelineRunnerService / skillExecutor       │
└──────┬───────────────────────────┬──────────┘
       │                           │
┌──────▼──────┐            ┌───────▼─────────┐
│ 流水线引擎   │            │   Agent 引擎     │
│ (pipeline-  │            │  (agent-engine)  │
│  engine)    │            │   Claude/Codex   │
└──────┬──────┘            └─────────────────┘
       │
┌──────▼──────┐
│  数据层      │
│  (packages/  │
│   db + ORM)  │
└─────────────┘
```

## 设计原则

- **AI 优先** — 每个接口都为 AI agent 的可发现性和可调用性设计
- **类型安全** — 全链路 TypeScript + Zod schema 验证
- **Result 类型** — 使用 neverthrow，零 try-catch
- **DAG 调度** — 流水线引擎基于拓扑排序的有向无环图
- **依赖注入** — 节点通过 `NodeContext` 接收外部依赖

## 数据流

```
用户操作 → API 服务器 → 服务层 → 流水线引擎
                                      │
                                      ├── 节点调度（拓扑排序）
                                      ├── 操作执行（Agent 引擎）
                                      └── 结果收集 → 数据库
```

## 技术栈

| 组件 | 技术 |
|------|------|
| Monorepo | Turborepo + Bun Workspaces |
| 前端 | React 19 + Vite + TanStack Router |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 后端 | Hono (Node.js) |
| 数据库 | PostgreSQL + Drizzle ORM |
| AI Agent | Claude CLI + Codex CLI |
| 类型系统 | TypeScript 5.9 + Zod |
| 错误处理 | neverthrow |
| 测试 | Vitest + Playwright |
| Lint | OxLint |
| 格式化 | OxFormatter |
