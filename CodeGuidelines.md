# Ordine 代码规范指南

> 本文件是项目唯一的代码规范权威来源。所有开发工作（人工或 AI 代理）在编写代码前必须阅读并遵守。

---

## 一、开发流程：后端先行（Backend-First）

涉及前后端联动时，严格遵循以下顺序，**禁止跳步或调换**：

1. **后端**：Schema → DAO → Service → tRPC 路由
2. **后端测试**：验证接口数据返回准确
3. **前端**：基于已验证接口构建 UI（Store → Content → Wrapper）
4. **前端测试**：E2E 验证端到端效果

---

## 二、错误处理：Zero try-catch

**业务代码中禁止任何 `try-catch`、`try-finally`、`.catch()`。** 统一使用 `neverthrow` 库。

### 同步操作 → `Result<T, E>`

```typescript
import { Result, ok, err } from "neverthrow";

function parseConfig(raw: string): Result<Config, ParseError> {
  return Result.fromThrowable(
    () => JSON.parse(raw),
    (e) => new ParseError("Invalid JSON", String(e)),
  )();
}
```

### 异步操作 → `ResultAsync<T, E>`

```typescript
import { ResultAsync } from "neverthrow";

function fetchUser(id: string): ResultAsync<User, NetworkError> {
  return ResultAsync.fromPromise(
    fetch(`/api/users/${id}`).then((r) => r.json()),
    (e) => new NetworkError("fetch failed", e),
  );
}
```

### 调用方必须显式处理错误

```typescript
// ✅ 正确
const result = await fetchUser(id);
if (result.isErr()) return result.mapErr(toAppError);
const user = result.value;

// ❌ 禁止
try {
  await fetchUser(id);
} catch (e) {
  console.error(e);
}
```

### 错误类型定义规范

```typescript
// ✅ 具名错误类，含可选 cause
class NotFoundError extends Error {
  constructor(
    public readonly resource: string,
    public readonly id: string,
  ) {
    super(`${resource}:${id} not found`);
    this.name = "NotFoundError";
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
```

---

## 三、类型系统：Zod 是唯一真相来源

**禁止手写 `interface` / `type` 与 Zod schema 重复定义。** 所有类型从 schema 派生。

```typescript
// ✅ 正确
import { z } from "zod";

export const CreateJobSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().min(0).max(10),
});
export type CreateJobInput = z.infer<typeof CreateJobSchema>;

// ❌ 禁止：与 schema 重复，失去同步
interface CreateJobInput {
  name: string;
  priority: number;
}
```

**Drizzle ORM 类型同理，从表定义派生：**

```typescript
// ✅
type JobRow = typeof jobsTable.$inferSelect;
type NewJobRow = typeof jobsTable.$inferInsert;

// ❌ 禁止手写 interface JobRow { id: string; ... }
```

---

## 四、DAO 规范

文件位于 `packages/models/daos/`，**一表一文件**，导出对象形式。

### 文件结构

```typescript
// ✅ 文件名：jobsDao.ts
import { eq } from "drizzle-orm";
import { db } from "@repo/db";
import { jobsTable } from "@repo/db-schema";

// 从表定义派生类型，不手写 interface
type JobRow = typeof jobsTable.$inferSelect;
type NewJobRow = typeof jobsTable.$inferInsert;
// 正确的事务类型（不用 NodePgDatabase，避免类型不匹配）
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const jobsDao = {
  // 查询单条：找不到返回 null，不抛出
  async findById(id: string): Promise<JobRow | null> {
    const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    return rows[0] ?? null;
  },

  // 查询多条：找不到返回 []
  async findManyByStatus(status: string): Promise<JobRow[]> {
    return db.select().from(jobsTable).where(eq(jobsTable.status, status));
  },

  // 写操作：接受可选 tx 参数，支持事务
  async create(data: NewJobRow, tx?: Tx): Promise<JobRow> {
    const client = tx ?? db;
    const rows = await client.insert(jobsTable).values(data).returning();
    return rows[0]!;
  },

  async update(id: string, data: Partial<NewJobRow>, tx?: Tx): Promise<JobRow | null> {
    const client = tx ?? db;
    const rows = await client.update(jobsTable).set(data).where(eq(jobsTable.id, id)).returning();
    return rows[0] ?? null;
  },

  async delete(id: string, tx?: Tx): Promise<void> {
    const client = tx ?? db;
    await client.delete(jobsTable).where(eq(jobsTable.id, id));
  },
};
```

### 方法命名规范

| 操作         | 方法名                           | 返回类型               |
| ------------ | -------------------------------- | ---------------------- |
| 按字段查单条 | `findBy{Field}`                  | `Promise<Row \| null>` |
| 查多条       | `findMany` / `findManyBy{Field}` | `Promise<Row[]>`       |
| 创建         | `create`                         | `Promise<Row>`         |
| 更新         | `update`                         | `Promise<Row \| null>` |
| 删除         | `delete`                         | `Promise<void>`        |

> **跨表写操作** → 必须触发 `repository-best-practice` skill，创建 Repository 封装事务。

---

## 五、Service 规范

Service 负责业务逻辑，**禁止直接导入 `db`**，必须通过 DAO 依赖注入，返回 `ResultAsync`。

```typescript
// ✅ services/jobService.ts
import { ok, errAsync, ResultAsync } from "neverthrow";
import { jobsDao } from "@repo/models";
import { NotFoundError, ConflictError } from "@repo/shared";

export const createJobService = (deps: { dao: typeof jobsDao }) => {
  const { dao } = deps;

  return {
    getById(id: string): ResultAsync<JobRow, NotFoundError> {
      return ResultAsync.fromPromise(dao.findById(id), () => new NotFoundError("Job", id)).andThen(
        (row) => (row ? ok(row) : errAsync(new NotFoundError("Job", id))),
      );
    },

    create(input: CreateJobInput): ResultAsync<JobRow, ConflictError> {
      return ResultAsync.fromPromise(
        dao.findByName(input.name),
        (e) => new ConflictError(String(e)),
      ).andThen((existing) => {
        if (existing) return errAsync(new ConflictError(`Job "${input.name}" exists`));
        return ResultAsync.fromPromise(dao.create(input), (e) => new ConflictError(String(e)));
      });
    },
  };
};

// ❌ 禁止
import { db } from "@repo/db"; // Service 不得直接使用 db
```

**tRPC 路由职责边界**：仅做输入校验 + Service 调用，不含业务逻辑：

```typescript
// ✅ src/integrations/trpc/routers/jobs.ts
export const jobsRouter = router({
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const result = await ctx.services.jobService.getById(input.id);
    if (result.isErr()) throw new TRPCError({ code: "NOT_FOUND" });
    return result.value;
  }),
});
```

---

## 六、前端数据获取：Refine hooks

**禁止在 React 组件中直接调用 tRPC 客户端。** 必须通过 Refine DataProvider。

```tsx
// ✅ 通过 Refine hooks
import { useList, useOne, useCreate, useUpdate, useDelete } from "@refinedev/core"

export const JobList = () => {
  const { data } = useList({ resource: "jobs" })
  return <ul>{data?.data?.map((j) => <li key={j.id}>{j.name}</li>)}</ul>
}

// ❌ 禁止直接调用 tRPC
import { trpc } from "@/lib/trpc"
const { data } = trpc.jobs.list.useQuery()            // 禁止
const { data } = useQuery({ queryFn: () => ... })     // 禁止
```

---

## 七、页面结构（Page Anatomy）

每个页面是独立目录，分三层：**Wrapper**（组装/DI）、**Content**（UI 实现）、**可选 Store**。

```
src/pages/JobListPage/
├── index.ts                    # 仅 re-export
├── JobListPage.tsx             # Wrapper：注入 Store Provider，组装布局
├── JobListPageContent.tsx      # View：具体 UI，从 Store 读取状态
└── _store/
    ├── index.ts
    ├── provider.tsx            # <JobListPageStoreProvider>
    ├── jobListPageSlice.ts     # 状态 + 动作定义
    └── jobListPageStore.ts     # 组合 slices，创建 store 实例
```

```tsx
// ✅ Wrapper：仅负责 Provider 包裹，不含 UI 细节
export const JobListPage = () => (
  <JobListPageStoreProvider>
    <JobListPageContent />
  </JobListPageStoreProvider>
);

// ✅ Content：从 Store 获取状态，不接收业务 Props
export const JobListPageContent = () => {
  const jobs = useJobListPageStore((s) => s.jobs);
  const loadJobs = useJobListPageStore((s) => s.loadJobs);
  // ...
};
```

---

## 八、Zustand Store：Slice 模式

```typescript
// ✅ jobListPageSlice.ts
import { StateCreator } from "zustand";

export interface JobListPageSlice {
  jobs: Job[];
  isLoading: boolean;
  loadJobs: () => Promise<void>;
}

export const createJobListPageSlice: StateCreator<JobListPageSlice> = (set) => ({
  jobs: [],
  isLoading: false,
  loadJobs: async () => {
    set({ isLoading: true });
    // 调用 service，结果写入 store
    set({ jobs: result.value, isLoading: false });
  },
});

// ✅ jobListPageStore.ts
import { createStore } from "zustand";

export type JobListPageStore = JobListPageSlice; // 可组合多 slice

export const createJobListPageStore = () =>
  createStore<JobListPageStore>((...a) => ({
    ...createJobListPageSlice(...a),
  }));
```

**Store 规则：**

- Store 只保存**跨组件共享**状态；组件私有状态用 `useState`
- **禁止**可变全局变量；状态变更只通过 store actions
- **禁止** Props 透传（Props Drilling）——跨组件状态从 Store 取

---

## 九、Barrel Export（桶导出）

`index.ts` **只做 re-export**，禁止包含任何业务逻辑、常量或函数：

```typescript
// ✅
export * from "./Button";
export * from "./Input";

// ❌ 显式命名导出（用 export *）
export { Button } from "./Button";

// ❌ default export
export default Button;

// ❌ 别名路径
export * from "@/components/Button";

// ❌ 业务逻辑混入
export const API_BASE = "/api/v1";
```

非 `index` 文件**不得 re-export 外部模块**（消费文件应直接从来源 import）：

```typescript
// ❌ someFeature.ts 中禁止中转导出
export { Button } from "../ui/Button";
```

---

## 十、React 样式与组件规范

### 条件 className 用 `cn()`

```tsx
// ✅
import { cn } from "@/lib/utils"
<div className={cn("base", isActive && "active", className)} />

// ❌ 禁止模板字符串
<div className={`base ${isActive ? "active" : ""}`} />
```

### 优先使用 shadcn/ui 组件

```tsx
// ✅
import { Button } from "@/components/ui/button"
<Button variant="outline" onClick={handleClick}>提交</Button>

// ❌ 禁止裸 HTML 元素（有对应 shadcn/ui 组件时）
<button onClick={handleClick}>提交</button>
<input type="text" />
```

### `useEffect` 限制

```tsx
// ✅ 允许：DOM 原生监听（无法用其他方式替代）
useEffect(() => {
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler); // 必须清理
}, []);

// ❌ 禁止：数据获取 → 改用 Refine hooks
useEffect(() => {
  fetchJobs().then(setJobs);
}, []);

// ❌ 禁止：事件响应 → 改用 handler 函数
useEffect(() => {
  if (isOpen) loadData();
}, [isOpen]);
```

---

## 十一、单文件单一职责

| 文件类型   | 规则                   |
| ---------- | ---------------------- |
| `.tsx`     | 仅一个 React 组件      |
| DAO        | 一张表对应一个文件     |
| Service    | 一个业务域对应一个文件 |
| `index.ts` | 仅 re-export，无逻辑   |

---

## 十二、测试规范

- 最低覆盖率：**80%**
- 工作流：先写失败测试（Red）→ 最小实现（Green）→ 重构（Improve）
- 单元测试：Vitest，与源码同目录或在 `tests/` 子目录
- E2E：Playwright，在 `e2e/` 目录
- **不得为通过测试而修改测试本身**（除非测试本身有误）

---

## 十三、安全规范

提交前必查：

- [ ] 无硬编码 API Key / 密码 / Token（用环境变量）
- [ ] 所有用户输入已用 Zod schema 校验
- [ ] SQL 通过 Drizzle ORM 参数化查询，禁止字符串拼接
- [ ] 错误信息不泄露内部路径、堆栈或敏感数据
- [ ] 认证/鉴权逻辑已验证

---

## 十四、AI 优先设计原则

- 优先声明式配置，而非命令式代码
- 精简接口、严格限定类型，消除歧义
- 命名贴合语义：校验用 `check`，修复用 `fix`
- 多方案等价时，选择更便于自动化执行的方案
- 所有功能确保 AI 代理可顺畅发现、调用及组合
