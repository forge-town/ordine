# 什么是 Ordine？

Ordine 是一个**代码质量的元编排引擎**。它让你定义最佳实践，将它们组合成操作，通过流水线串联操作，然后让 AI agent 和脚本自动执行。

## 问题

现代代码库的增长速度超过了团队的评审能力。代码风格、架构模式、安全实践和文档标准会随时间漂移。手动执行无法扩展。

## 解决方案

Ordine 提供了一种结构化的方式来：

1. **捕获** 团队的编码规范，转化为机器可读的最佳实践
2. **定义** 使用 AI agent 或脚本检查/修复代码的操作
3. **组合** 操作成多步骤流水线（DAG 执行）
4. **自动化** 通过规则在代码变更时触发流水线

## 核心优势

### AI 优先设计

每个功能都为 AI agent 的可发现性、可调用性和可组合性而设计。操作可以使用 Claude、Codex 或自定义脚本作为后端。

### 声明式配置

流水线、操作和技能都是数据驱动的。以 JSON/YAML 定义，而非命令式代码。这使它们可移植、可版本控制、agent 可访问。

### 类型化流水线引擎

流水线引擎使用有向无环图（DAG），节点和边均具有类型定义。每个节点都有明确的输入和输出，实现安全的组合。

### 可扩展架构

- **技能** — 插入新的 AI 能力
- **操作** — 定义自定义检查/修复任务
- **节点类型** — folder、code-file、operation、output、compound、condition、github-project

## 技术栈

| 层级 | 技术 |
|------|------|
| Monorepo | Turborepo + Bun Workspaces |
| 前端 | React + Vite + TanStack Router + Refine |
| 后端 | Hono (Node.js) |
| 数据库 | PostgreSQL + Drizzle ORM |
| AI Agent | Claude CLI, Codex CLI |
| 类型安全 | TypeScript + Zod schemas |
| 错误处理 | neverthrow (Result 类型) |
| 测试 | Vitest + Playwright |
