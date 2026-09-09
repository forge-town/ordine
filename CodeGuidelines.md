# Ordine 代码规范

本文件是项目代码规范的唯一权威来源；修改对应层时查阅相关章节。工作范围与验证策略见 [AGENTS.md](AGENTS.md)。

## 数据契约与分层

- 新的前后端契约先明确 Schema → DAO → Service → tRPC 的数据与错误约定，再完成前端集成。已有契约足够时，不重做未变化的层。
- 已有 Zod schema 的领域类型由 `z.infer` 派生，不手写重复 `interface` / `type`。数据库读写类型由表的 `$inferSelect` / `$inferInsert` 派生；无对应 schema 的组件 Props 或 Store 行为类型按实际需要定义。
- 一个包对应一个领域，通过 `package.json` 声明的公开入口跨包访问，使用 ESM 和 `workspace:*`。

## 错误处理

- 业务代码统一用 `neverthrow`，禁止直接使用 `try-catch`、`try-finally` 或 `.catch()`。
- 可能抛错的同步操作用 `Result.fromThrowable`，异步操作用 `ResultAsync.fromPromise`；调用方显式处理 `isErr()` 或组合 Result，不能吞掉失败。
- 错误使用具名类型，保留必要的 cause；对外响应经边界映射，不泄露内部路径、堆栈或敏感数据。

## DAO 与事务

- DAO 位于 `packages/models/src/daos/`，一表一文件，命名 `<entity>Dao.ts`，导出 DAO 对象。
- 查单条返回 `Row | null`，查多条返回 `Row[]`；写操作支持可选事务参数。事务类型从 `typeof db.transaction` 推导，不用不匹配的 `NodePgDatabase` 代替。
- 跨表写操作由 Repository 封装事务，保证原子性和一致性；参考同领域现有实现，不依赖某个技能是否已安装。
- 使用 Drizzle 参数化查询，禁止拼接用户输入构造 SQL。

| 操作   | 方法名                           | 返回值                 |
| ------ | -------------------------------- | ---------------------- |
| 查单条 | `findBy{Field}`                  | `Promise<Row \| null>` |
| 查多条 | `findMany` / `findManyBy{Field}` | `Promise<Row[]>`       |
| 创建   | `create`                         | `Promise<Row>`         |
| 更新   | `update`                         | `Promise<Row \| null>` |
| 删除   | `delete`                         | `Promise<void>`        |

## Service 与 tRPC

- Service 一域一文件，通过依赖注入使用 DAO，返回 `ResultAsync`，不得直接导入数据库连接 `db`。
- tRPC 路由只负责输入校验、Service 调用和边界错误映射，不放业务逻辑。
- 用户输入用 Zod 校验；涉及认证或权限的变更验证相应边界。

## 页面与数据获取

- 每个页面独立目录，由 Wrapper（布局组装与 DI）、Content（UI）和可选 Store 组成；`index.ts` 仅 re-export。
- Wrapper 不含 UI 实现细节，Content 从 Store 读取共享业务状态，不经业务 Props 层层传递。
- React 组件通过 Refine hooks / DataProvider 获取数据，不直接调用 tRPC 客户端或绕过 DataProvider 自建查询。
- Zustand 使用 slice 模式，只存跨组件共享状态；组件私有状态用 `useState`。禁止可变全局状态，共享状态变更通过 Store actions。
- `.tsx` 文件只定义一个 React 组件；新增功能保持文件职责单一。

## 导出

- barrel `index.ts` 仅使用相对路径的 `export *`，不放业务逻辑、常量或函数；不使用 default export、别名路径或显式命名转导出。
- 非 `index` 文件不得中转导出外部模块，消费方直接从公开来源 import。
- 保留包已声明的子路径入口，不为遵循 barrel 规则破坏现有公开 API。

## 组件与样式

- 页面布局、卡片、圆角、间距和阴影遵循 [前端视觉规范](docs/frontend-ui.md)。
- 条件 `className` 使用 `cn()`，不使用模板字符串拼接。
- 有对应 shadcn/ui 组件时使用现有组件，不重复实现裸 HTML 控件。
- `useEffect` 不用于数据获取或事件响应：分别使用 Refine hooks 和事件 handler。无法替代的原生 DOM 监听可用 effect，并清理监听。

## 验证与安全

- 按 [AGENTS.md](AGENTS.md) 选择受影响检查；保留配置和 CI 已要求的验证。Vitest 与 Playwright 沿用包内目录约定。
- 可复现的行为缺陷优先添加回归用例；TDD 按任务采用，不强制每次改动先写失败测试或凑统一覆盖率。
- 不得为通过测试削弱断言；需求、契约变化或测试有误时可同步更新，并说明依据。
- 测试使用独立 fixtures 或测试库，不能清理用户日常数据库或生产数据。
- 所有提交禁止硬编码 API Key、密码、Token；使用现有环境配置和凭据机制。

## AI 接口

优先声明式配置和明确类型，使能力可被发现、调用和组合。校验用 `check` 命名，修复用 `fix`；等价方案优先选择便于自动化执行的方案。
