# 快速开始

几分钟内在本地运行 Ordine。

## 快速安装（推荐）

最快的运行方式 — 使用本地 Docker PostgreSQL 数据库：

```sh
docker run -d --name ordine-postgres -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ordine \
  -v ordine-postgres-data:/var/lib/postgresql/data postgres:16-alpine
until docker exec ordine-postgres pg_isready -U postgres -d ordine >/dev/null 2>&1; do sleep 1; done
npm create @ordine -- --yes
```

这会在 `http://localhost:9430` 启动程序，使用 Docker PostgreSQL，自动运行数据库迁移，并启用本地模式（单用户，无需登录）。

按 `Ctrl+C` 停止。

交互模式（可选择数据目录、端口等）：

```sh
npm create @ordine
```

## 从源码开发

### 前置条件

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.0+

### 安装

```sh
# 克隆仓库
git clone https://github.com/forge-town/ordine.git
cd ordine

# 安装依赖
bun install
```

### 数据库设置

先创建本地环境文件：

```sh
cp apps/app/.env.example apps/app/.env
cp apps/server/.env.example apps/server/.env
```

**数据库 — Docker PostgreSQL：**

```sh
bun run db:up
# 在两个 .env 文件中设置：
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ordine
```

然后推送 schema：

```sh
cd apps/app
bun run db:push
```

### 启动开发环境

```sh
# 从根目录
bun dev
```

通过 Turborepo 并行启动所有应用：

| 应用          | 地址                    | 说明              |
| ------------- | ----------------------- | ----------------- |
| `apps/app`    | `http://localhost:9430` | 主 Web 应用       |
| `apps/server` | `http://localhost:9433` | API 服务器 (Hono) |

### Local Mode

对于自托管单机器使用，启用 Local Mode 可以跳过登录页：

```sh
# 在 apps/app/.env 中
ORDINE_LOCAL_MODE=true
```

首次访问时自动创建本地用户并登录。⚠️ 请勿在共享或生产环境中启用。

## 创建你的第一个流水线

1. 打开 Web 应用 `http://localhost:9430`
2. 导航到 **操作** 并创建新操作
3. 导航到 **流水线** 并创建新流水线
4. 在画布中添加节点并连接
5. 点击 **运行** 执行

## 贡献策略

Beta 前暂不接受外部贡献，也暂不开放公开安全报告受理。

## CLI 使用

Ordine 还提供了 CLI 用于无头操作：

```sh
cd apps/cli
bun run src/index.ts --help
```

## 下一步

- 了解 [核心概念](/zh/guide/core-concepts) 理解实体模型
- 浏览 [Skills](/zh/skills/) 查看 AI agent 能用 成序 做什么
