# Ordine 智能代理规范文档

> Ordine：AI 优先的元编排引擎，面向自动化工作流任务调度。  
> **版本**：0.0.2-preview | **包管理器**：bun@1.3.11 | **Monorepo**：Turborepo

> ⚠️ **编写代码前必读：[CodeGuidelines.md](./CodeGuidelines.md)**  
> 所有代码规范（错误处理、类型系统、DAO/Service/Store、页面结构、样式等）均在该文件中。

---

## 一、项目结构速查

```
ordine/
├── apps/
│   ├── app/        # React SPA，端口 9430，主 UI
│   ├── server/     # Hono API 服务，端口 9433
│   ├── cli/        # 命令行工具
│   ├── docs/       # VitePress 文档站
│   └── scripts/    # 工具脚本
├── packages/
│   ├── schemas/        # Zod schema（共享领域类型）
│   ├── models/         # DAO，一表一文件
│   ├── services/       # 业务服务层
│   ├── db-schema/      # Drizzle 表定义
│   ├── db/             # 数据库连接与迁移
│   ├── pipeline-engine/# DAG 执行引擎
│   ├── agent/          # AI 代理集成
│   ├── agent-engine/   # 代理执行引擎
│   ├── ui/             # 共享 React 组件
│   ├── plugin/         # 插件系统核心
│   ├── plugins/        # 内置插件
│   ├── shared/         # 共享工具与类型
│   └── utils/          # 通用工具
└── skills/             # Ordine skill 定义
```

### apps/app 关键路径

| 路径                             | 说明                     |
| -------------------------------- | ------------------------ |
| `src/pages/`                     | 页面组件，每路由一目录   |
| `src/pages/<Page>/_store/`       | 页面级 Zustand slice     |
| `src/routes/`                    | TanStack Router 路由定义 |
| `src/integrations/trpc/routers/` | tRPC 路由                |
| `src/components/`                | 共享 UI 组件             |
| `e2e/`                           | Playwright E2E 测试      |

---

## 二、技术栈

| 层       | 技术                                             |
| -------- | ------------------------------------------------ |
| 前端框架 | React 19 + TanStack Router                       |
| 数据获取 | tRPC + Refine + TanStack Query                   |
| 状态管理 | Zustand（slice 模式）                            |
| UI 组件  | Tailwind CSS v4 + shadcn/ui                      |
| 后端框架 | Hono（Bun runtime）                              |
| ORM      | Drizzle ORM + postgres                           |
| 类型验证 | Zod（类型全部由 `z.infer` 派生）                 |
| 错误处理 | neverthrow（`Result<T,E>` / `ResultAsync<T,E>`） |
| 测试     | Vitest（单元）+ Playwright（E2E）                |
| 格式化   | oxfmt                                            |
| Lint     | oxlint                                           |

---

## 三、常用命令

```bash
# 开发
bun run dev                          # 启动所有 app（turbo）
ORDINE_LOCAL_MODE=true bun run dev   # 本地模式，绕过登录

# 质量检查（提交前必跑）
bun run quality          # lint + typecheck + test（turbo）
bun run format           # oxfmt 格式化
bun run format:check     # 格式检查（不写入）

# 测试
bun run test                       # 全部单元测试（turbo）
cd apps/app && bun run test        # app 单元测试
cd apps/app && bun run test:e2e    # Playwright E2E

# 其他
bun run check-types   # 全量 tsc
bun run lint          # 全量 lint
bun run knip          # 检测未使用导出
```

---

## 四、核心原则

详细规范见 **[CodeGuidelines.md](./CodeGuidelines.md)**，核心约束摘要：

1. **后端先行**：Schema → DAO → Service → tRPC → 前端，禁止跳步
2. **Zero try-catch**：业务代码统一用 `neverthrow`，禁止原生异常捕获
3. **Zod 唯一真相**：所有类型从 `z.infer` 派生，禁止手写重复 interface
4. **单文件单职责**：一个 `.tsx` 一个组件、一表一 DAO、一域一 Service
5. **Store 不 Props**：跨组件状态走 Zustand，禁止 Props Drilling
6. **Refine 数据层**：组件数据获取走 `useList`/`useOne`，禁止直接调用 tRPC

---

## 五、Git & PR 工作流

### 分支规则

- **不得**向上游 `forge-town/ordine` 推送工作分支
- 所有 feature/fix 分支在 fork `woodfishhhh/ordine` 下创建并推送
- 从最新 `upstream/develop` 切出，PR 目标指向 `upstream/develop`（非 `main`）

```bash
git fetch upstream
git checkout develop && git merge upstream/develop
git checkout -b issue-<N>-<slug>
git push origin issue-<N>-<slug>
```

### 提交格式（Conventional Commits）

```
<type>: <中文描述>
```

类型：`feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`

### 提交前检查清单

- [ ] `bun run quality` 全部通过
- [ ] `bun run format:check` 无差异
- [ ] 无硬编码密钥或凭据
- [ ] 受影响 UI 已在浏览器中验证（截图存入 `pr-assets/`）

### PR 说明要求

- 前端视觉变更：附 before/after 截图（desktop + narrow viewport）
- 前端行为变更无视觉差异：说明"无视觉样式截图差异"并附浏览器验证证据

---

## 六、已知本地环境问题

| 问题             | 说明                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nitro 构建失败   | 全量 `bun run build` 时 Nitro 无法解析 Node 内置 `https`（来自全局 `C:/Users/woodfish/node_modules/ws`），属本地 env 问题，不影响 app/server 构建 |
| E2E fixture 超时 | Playwright E2E 在本地 `/login` networkidle 前超时，属已知本地问题                                                                                 |
| 全量 tsc 阻塞    | `apps/app/src/pages/CanvasPage/OperationNode/OperationNode.tsx` 存在 Select `onValueChange` 签名不匹配，阻塞全量 tsc                              |
| 本地模式登录     | 绕过登录需 `ORDINE_LOCAL_MODE=true` 启动 Vite；路由按 `local@ordine.local` 是否存在判断 sign-up，而非 users 总数                                  |

---

## 七、包规范

- 一个包 = 一个领域，通过公开 API（`index.ts`）导出
- 所有导出通过 barrel `index.ts`，**不在非 index 文件中 re-export 外部模块**
- 新增包需在根 `package.json` workspaces 中注册
- `package.json` 使用 `"type": "module"`
- 内部依赖使用 `workspace:*`
