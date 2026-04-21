# Monorepo 结构

Ordine 使用 Turborepo + Bun Workspaces 管理 monorepo。

## 目录结构

```
ordine/
├── apps/
│   ├── app/          # 主 Web 应用 (React + Vite)
│   ├── cli/          # 命令行工具
│   ├── docs/         # 文档站点 (VitePress)
│   ├── scripts/      # 构建/部署脚本
│   ├── server/       # API 服务器 (Hono)
│   └── web/          # 营销网站 (Next.js)
├── packages/
│   ├── agent/        # AI agent 运行器 (Claude/Codex)
│   ├── agent-engine/ # Agent 调度引擎 (已弃用 tmux, 仅 direct 模式)
│   ├── db/           # 数据库连接和迁移
│   ├── db-schema/    # Drizzle ORM schema 定义
│   ├── logger/       # 结构化日志
│   ├── models/       # 数据访问对象 (DAO)
│   ├── obs/          # 可观测性
│   ├── pipeline-engine/ # DAG 流水线调度器
│   ├── plugin/       # 插件系统
│   ├── plugins/      # 内置插件
│   ├── schemas/      # 共享 Zod schemas
│   ├── services/     # 业务逻辑服务
│   ├── ui/           # 共享 UI 组件 (shadcn/ui)
│   └── utils/        # 通用工具函数
├── skills/           # 内置 AI 技能定义
└── docs/             # 规格文档
```

## 应用说明

| 应用 | 技术 | 说明 |
|------|------|------|
| `apps/app` | React + Vite | 主 Web 应用，包含流水线画布、实体管理 UI |
| `apps/server` | Hono | REST + tRPC API 服务器 |
| `apps/cli` | TypeScript | 命令行界面 |
| `apps/web` | Next.js | 营销和文档网站 |

## 关键 Package

| Package | 说明 |
|---------|------|
| `pipeline-engine` | DAG 调度器，拓扑排序，节点类型，边传递 |
| `agent-engine` | 将操作分发到 Claude/Codex 后端 |
| `services` | 业务逻辑：流水线运行、技能执行、提示词执行 |
| `models` | DAO 层，所有数据库操作封装 |
| `schemas` | 共享 Zod schema，确保前后端类型一致 |

## 依赖关系

```
apps/app ──► packages/ui
apps/server ──► packages/services ──► packages/models
                                  ──► packages/pipeline-engine
                                  ──► packages/agent-engine ──► packages/agent
```

## 构建命令

```sh
# 开发
bun dev

# 构建所有
bun run build

# 运行测试
bun run test

# Lint
bun run lint
```
