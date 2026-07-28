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

### Linear 协同开发流程

- 开始 issue 开发前，必须先用 Linear（或用户给出的 Linear 上下文）查看
  `Code Nerds` / `Ordine` project 的当前 issue 状态、描述、评论与
  relations；不要只凭标题编号或本地记忆开工。
- 执行顺序以 Linear 的 `blockedBy` / `blocks` 关系和当前状态为准，标题里的 `#` 编号只作参考；被未完成 issue 阻塞的任务不得当作已解锁处理。
- 已经在 Linear 拆好的 issue 不要重新规划或重复创建；直接按现有 issue 描述、验收标准、评论和依赖推进。
- 动手改代码前，先向用户明确准备做哪个 issue、为什么现在可开工、依赖/阻塞情况是什么；用户确认或没有异议后再切分支和修改文件。
- 选定 issue 后，当前会话有 Linear 写权限/工具时，将 Linear 状态更新为
  `In Progress`；若无写权限/工具，必须向用户说明未更新，不能假装已同步。
  如果发现依赖未合并、权限/工具不可用或范围需要重新拍板，停下说明，并在
  Linear 评论或对话中记录阻塞证据。
- PR 创建后，当前会话有 Linear 写权限/工具时，将 Linear 状态更新为
  `In Review` 并附 PR 链接；若无写权限/工具，必须在最终回复中明确说明
  Linear 未同步，并在 PR 描述中写清 issue ID、验证结果、交叉 review 证据与
  剩余风险。

### 分支规则

- **不得**向上游 `forge-town/ordine` 推送工作分支
- 所有 feature/fix 分支在 fork `woodfishhhh/ordine` 下创建并推送
- 从最新的上游 `develop` 切出，PR 目标指向 `forge-town/ordine` 的
  `develop`（非 `main`）；不同工作树的上游 remote 名可能是 `origin` 或
  `upstream`，操作前先用 `git remote -v` 确认。

```bash
git remote -v
git fetch <upstream-remote>
git checkout develop && git merge <upstream-remote>/develop
git checkout -b issue-<N>-<slug>
git push origin issue-<N>-<slug>
```

### 提交格式（Conventional Commits）

```
<type>: <中文描述>
```

类型：`feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`

### 独立交叉 Review 门（硬性）

- 每个 issue 的实现与本地验证完成后、提交 PR 前，必须做一次独立交叉
  review：review 工具必须独立于当前执行 agent，优先调用 **Claude Code
  MCP**，对该 issue 相对 PR base 的完整 diff 做 review。
- 本门默认适用于所有 Linear 风险标签（红/黄/绿）；如历史规则或旧记忆存在
  “绿标免审”说法，在本仓库以本节为准。只有用户在当次任务中明确豁免时才可
  跳过独立交叉 review。
- 如当前会话没有 Claude Code MCP，但用户或项目规则允许等价执行，可用
  Claude Code CLI、独立 sub-agent 或其它独立代码审查工具审查完整 diff，并在
  PR 说明中记录降级原因、命令/工具与覆盖范围。
- 不得只抽查文件，也不得用当前执行 agent 的自审代替独立交叉 review。
- Review 必须覆盖 bug、回归、安全、性能、可维护性和测试缺口，并按严重性输出带文件/行号的 finding。
- 所有 finding 必须在提交 PR 前逐条处理：修复，或在 PR 说明中记录不采纳理由与证据。未解决的高/中严重性 finding 阻塞 PR。
- Review 后若发生影响行为或架构的实质修改，必须再次用同等级独立 review
  工具复审相关 diff，并重新运行受影响测试。
- PR 说明必须记录交叉 review 证据：review 工具、覆盖的 diff/base、finding 及处理结果。
- 只有在项目/用户明确要求特定工具（如 Claude Code MCP）时，该工具不可用、
  调用失败或无法覆盖完整 diff 才阻塞 PR；否则使用用户或项目规则认可的独立
  review 工具继续。没有任何可用且被认可的独立 review 工具时，必须停下确认，
  不得静默跳过或换成同一 agent 自审后继续提 PR。

### 提交前检查清单

- [ ] 已通过 Linear（或用户给出的 Linear 上下文）确认 issue scope、依赖拓扑和当前状态
- [ ] 如本会话无 Linear 写权限/工具，已声明“未更新 Linear 状态”，并在 PR 或最终回复中记录
- [ ] `bun run quality` 全部通过
- [ ] `bun run format:check` 无差异
- [ ] 无硬编码密钥或凭据
- [ ] 受影响 UI 已在浏览器中验证（截图存入 `pr-assets/`）
- [ ] 已完成独立交叉 review（Claude Code MCP / CLI / 用户认可的等价工具），finding 已全部处理或有证据地记录

### PR 说明要求

- 所有 PR：写明 Linear issue ID、验证结果、独立交叉 review 证据（工具/命令、降级原因、覆盖的 diff/base、finding 与处理结果）和剩余风险
- 前端视觉变更：附 before/after 截图（desktop + narrow viewport）
- 前端行为变更无视觉差异：说明"无视觉样式截图差异"并附浏览器验证证据

---

## 六、已知本地环境问题

| 问题             | 说明                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Nitro 构建失败   | 全量 `bun run build` 时 Nitro 无法解析 Node 内置 `https`（来自全局 `C:/Users/<user>/node_modules/ws`），属本地 env 问题，不影响 app/server 构建 |
| E2E fixture 超时 | Playwright E2E 在本地 `/login` networkidle 前超时，属已知本地问题                                                                               |
| 全量 tsc 阻塞    | `apps/app/src/pages/CanvasPage/OperationNode/OperationNode.tsx` 存在 Select `onValueChange` 签名不匹配，阻塞全量 tsc                            |
| 本地模式登录     | 绕过登录需 `ORDINE_LOCAL_MODE=true` 启动 Vite；路由按 `local@ordine.local` 是否存在判断 sign-up，而非 users 总数                                |

---

## 七、包规范

- 一个包 = 一个领域，通过公开 API（`index.ts`）导出
- 所有导出通过 barrel `index.ts`，**不在非 index 文件中 re-export 外部模块**
- 新增包需在根 `package.json` workspaces 中注册
- `package.json` 使用 `"type": "module"`
- 内部依赖使用 `workspace:*`
