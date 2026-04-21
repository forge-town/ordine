# 成序 (Ordine)

AI 优先的元编排引擎。

定义操作，组合流水线，选择喜欢的 AI agent，自动化任意工作流。代码质量自动化作为内置插件提供。

> 🚧 成序目前处于 **Preview 预览**阶段。API 和功能可能会发生变化。

## 功能

- **对象** — 流水线的类型化输入（文件夹、代码文件、GitHub 项目或通过插件自定义类型）
- **操作** — 原子级任务，支持 AI agent 或脚本作为执行器
- **流水线** — 将操作链接成多步骤 DAG 工作流
- **技能** — 可插拔的 AI agent 能力，驱动操作执行
- **Agent** — 任意选择喜欢的 AI agent 作为执行器 — Claude、GPT、Gemini 或自定义
- **任务** — 实时跟踪后台执行进度和追踪日志
- **插件** — 扩展新的对象类型、操作和领域特定工作流

## 快速开始

```sh
bun install
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env

# 先在两个 env 文件里配置 DATABASE_URL
cd apps/app && bun run db:push && cd ../..

bun dev
```

主应用：`http://localhost:9430`

API 服务：`http://localhost:9433`

## 项目状态

成序目前仍处于 Preview 阶段，API、数据模型和工作流在 Beta 前都可能调整。

## 贡献

Beta 发布前暂不接受外部贡献。当前策略见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安全

当前还没有公开的安全报告受理流程。预览阶段策略见 [SECURITY.md](./SECURITY.md)。

## 文档

访问[文档站点](https://docs.ordine.ai)查看指南、API 参考和技能库。

## 许可证

MIT © 2026 Code Forge AI
