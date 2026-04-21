# 快速开始

几分钟内在本地运行 Ordine。

## 前置条件

- [Node.js](https://nodejs.org/) v20+
- [Bun](https://bun.sh/) v1.0+
- PostgreSQL（本地或远程）

## 安装

```sh
# 克隆仓库
git clone https://github.com/forge-town/ordine.git
cd ordine

# 安装依赖
bun install
```

## 数据库设置

将 schema 推送到数据库：

```sh
cd apps/app
bun run db:push
```

::: tip
确保 PostgreSQL 连接字符串已在环境变量中配置。参见 `.env.example` 了解所需变量。
:::

## 启动开发环境

```sh
# 从根目录
bun dev
```

通过 Turborepo 并行启动所有应用：

| 应用 | 地址 | 说明 |
|------|------|------|
| `apps/app` | `http://localhost:5173` | 主 Web 应用 |
| `apps/server` | `http://localhost:9433` | API 服务器 (Hono) |

## 创建你的第一个流水线

1. 打开 Web 应用 `http://localhost:5173`
2. 导航到 **操作** 并创建新操作
3. 导航到 **流水线** 并创建新流水线
4. 在画布中添加节点并连接
5. 点击 **运行** 执行

## CLI 使用

Ordine 还提供了 CLI 用于无头操作：

```sh
cd apps/cli
bun run src/index.ts --help
```

## 下一步

- 了解 [核心概念](/zh/guide/core-concepts) 理解实体模型
- 浏览 [Skills](/zh/skills/) 查看 AI agent 能用 成序 做什么
