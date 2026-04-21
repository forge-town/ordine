# tRPC API

Ordine 通过 tRPC 提供类型安全的 API，主要用于需要实时推送的场景。

## 可用过程

### 任务

```typescript
// 获取任务状态（支持实时轮询）
trpc.jobs.getById.query({ id: "job_abc123" });

// 获取任务列表
trpc.jobs.list.query({ page: 1, pageSize: 20 });
```

### 设置

```typescript
// 获取应用设置
trpc.settings.get.query();

// 更新设置
trpc.settings.update.mutate({ key: "value" });
```

## 客户端用法

### React

```typescript
import { trpc } from "@/lib/trpc";

function JobStatus({ jobId }: { jobId: string }) {
  const { data: job } = trpc.jobs.getById.useQuery(
    { id: jobId },
    { refetchInterval: 2000 } // 每 2 秒轮询
  );

  return <div>状态：{job?.status}</div>;
}
```

### 直接调用

```typescript
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "@ordine/server";

const client = createTRPCClient<AppRouter>({
  url: "http://localhost:9433/trpc",
});

const job = await client.jobs.getById.query({ id: "job_abc123" });
```
