<div align="center">

<img alt="Ordine" src="docs/assets/logo.svg" width="80">

# 成序 (Ordine)

**定义一次，让 Agent 来完成剩余的工作。**

开源 AI Agent 优先的工作调度框架。<br/>
将操作组合成流水线，接入任意 AI agent，自动化任意工作流 — 代码质量、数据处理或你自己的领域。

[![CI](https://github.com/forge-town/ordine/actions/workflows/ci.yml/badge.svg)](https://github.com/forge-town/ordine/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/forge-town/ordine?style=flat)](https://github.com/forge-town/ordine/stargazers)

[文档](https://docs.ordine.ai) · [贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md)

**[English](README.md) | 简体中文**

</div>

> 🚧 成序目前处于 **Preview 预览**阶段。API 和功能在 Beta 前可能发生变化。

---

## 什么是成序？

成序是一款 **AI Agent 优先的工作调度框架**，允许你定义类型化的操作，将其组合成 DAG 流水线，并通过任意 AI agent 或脚本执行器运行。

不再需要散落各处的脚本，不再需要盯着 agent 一步步执行。将工作流一次性定义为流水线，然后让 Claude、GPT、Gemini 或自定义 agent 去执行。Agent 是第一公民运行时，而非事后补充。代码质量自动化作为内置插件随附。

## 功能

- **对象** — 流水线的类型化输入（文件夹、代码文件、GitHub 项目或通过插件自定义类型）
- **操作** — 原子级任务，支持 AI agent 或脚本作为执行器
- **流水线** — 将操作链接成多步骤 DAG 工作流
- **技能** — 可插拔的 AI agent 能力，驱动操作执行
- **Agent** — 任意选择喜欢的 AI agent 作为执行器 — Claude、GPT、Gemini 或自定义 Agent
- **任务** — 实时跟踪后台执行进度和追踪日志
- **插件** — 扩展新的对象类型、操作和领域特定工作流

---

## 快速开始

### 方式一 — 快速安装（推荐）

最快的本地运行方式 — 无需外部数据库或配置：

```sh
npm create @ordine -- --yes
```

这会在 `http://localhost:9430` 启动成序，使用嵌入式 PostgreSQL（PGLite），自动运行迁移，并启用本地模式（单用户，无需登录）。

按 `Ctrl+C` 停止。

交互模式（可选择数据目录、端口等）：

```sh
npm create @ordine
```

### 方式二 — 从源码开发

```sh
# 克隆仓库
git clone https://github.com/forge-town/ordine.git
cd ordine

# 安装依赖
bun install

# 创建环境文件
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env
```

**数据库 — 二选一：**

- **PGLite（嵌入式，无需外部数据库）：**
  ```sh
  # 在两个 .env 文件中设置：
  PGLITE_DATA_DIR=./.pglite
  ```

- **PostgreSQL（外部）：**
  ```sh
  # 在两个 .env 文件中设置：
  DATABASE_URL=postgresql://postgres:<密码>@localhost:5432/ordine
  ```

推送 schema：
```sh
cd apps/app && bun run db:push && cd ../..
```

启动开发环境：
```sh
bun dev
```

| 服务 | 地址 |
|------|------|
| 主应用 | http://localhost:9430 |
| API 服务 | http://localhost:9433 |

> **💡 Local Mode（自托管、单用户）：**
> 在 `apps/app/.env` 中设置 `ORDINE_LOCAL_MODE=true`，首次访问时自动创建本地用户并跳过登录页。
> ⚠️ 请勿在共享或生产环境中启用。

---

## 项目状态

成序目前仍处于 Preview 阶段，API、数据模型和工作流在 Beta 前都可能调整。

## 贡献

Beta 发布前暂不接受外部贡献。当前策略见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 安全

当前还没有公开的安全报告受理流程。预览阶段策略见 [SECURITY.md](./SECURITY.md)。

## 文档

访问[文档站点](https://docs.ordine.ai)查看指南、API 参考和技能库。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=forge-town/ordine&type=Date)](https://star-history.com/#forge-town/ordine&Date)

## 许可证

MIT © 2026 Code Forge AI
