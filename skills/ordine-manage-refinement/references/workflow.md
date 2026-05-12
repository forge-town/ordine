# Refinement 管理流程

## 运行前确认

先向用户确认：

- 源 Distillation ID：`sourceDistillationId`
- 最大轮数：`maxRounds`
- 是否允许自动创建优化后的 Pipeline
- 是否允许自动运行优化后的 Pipeline
- 是否允许每轮完成后创建新的 Distillation
- 预期停止条件：达到轮数、某轮失败、或用户手动停止

## 数据模型

核心字段：

- `id`：Refinement ID
- `sourceDistillationId`：初始 Distillation
- `maxRounds`：最大轮数
- `currentRound`：当前轮次
- `status`：`pending`、`running`、`completed`、`failed`
- `rounds`：轮次数组

每个 round 包含：

- `round`：轮次编号
- `pipelineId`：本轮优化生成的 Pipeline
- `jobId`：本轮 Pipeline run 的 Job
- `distillationId`：本轮运行后生成的 Distillation
- `status`：`pending`、`optimizing`、`running`、`distilling`、`completed`、`failed`
- `summary`：本轮蒸馏摘要
- `error`：本轮错误

## 当前接口形态

当前后端 REST app 没有挂载 `/api/refinements`。Refinement 能力通过 app tRPC router 暴露：

- `refinements.getMany`
- `refinements.getById`
- `refinements.start`
- `refinements.delete`

前端使用位置：

- `apps/app/src/integrations/trpc/routers/refinements.ts`
- `apps/app/src/pages/DistillationStudioPage/DistillationActionBar.tsx`
- `apps/app/src/components/RefinementPanel/RefinementPanel.tsx`

如果需要从命令行运行，优先使用已有 app/tRPC 调用方式；如果项目补了 REST route，再改用 REST。

## 启动 Refinement 的语义

服务层入口：

```ts
refinementsService.start({
  sourceDistillationId: "<distillation-id>",
  maxRounds: 3,
});
```

后台循环每轮执行：

1. 基于当前 Distillation 调用 `pipelinesService.optimizeFromDistillation`
2. 保存优化后的 Pipeline
3. 运行该 Pipeline
4. 等待 Job 完成
5. 基于 Job 创建新 Distillation
6. 运行新 Distillation
7. 将新 Distillation 作为下一轮输入

## 前置检查

启动前必须确认源 Distillation：

```bash
curl -s http://localhost:9433/api/distillations/<distillation-id> | python3 -m json.tool
```

确认：

- `status` 为 `completed`
- `result.type` 为 `completed`
- `result.insights`、`result.nextActions` 或 `result.reusableAssets` 有足够内容
- `mode` 与优化目标相关，通常为 `pipeline` 或 `failure`

## 监控方式

通过 tRPC 或前端查询 Refinement 记录：

- 查看 `status`
- 查看 `currentRound`
- 查看 `rounds[*].status`
- 如果某轮生成 `jobId`，用 Jobs API 查看：

```bash
curl -s http://localhost:9433/api/jobs/<job-id> | python3 -m json.tool
curl -s http://localhost:9433/api/jobs/<job-id>/traces | python3 -m json.tool
```

- 如果某轮生成 `distillationId`，用 Distillations API 查看：

```bash
curl -s http://localhost:9433/api/distillations/<distillation-id> | python3 -m json.tool
```

## 终态判断

成功：

- Refinement `status` 为 `completed`
- 每轮 `rounds[*].status` 为 `completed`
- 每轮都有 `pipelineId`、`jobId`、`distillationId`
- 最后一轮 `summary` 能解释优化效果

部分失败：

- Refinement 可能仍走到 `completed`，但某些 round 为 `failed`
- 需要逐轮检查 `rounds[*].error`

失败：

- Refinement `status` 为 `failed`
- 查看服务日志、相关 Job traces、对应 Distillation result

## 排查

- 源 Distillation 不存在：`start` 返回空结果
- 优化结果为空：该轮 `error` 为 `Pipeline optimization returned empty`
- Pipeline 创建后找不到：该轮 `error` 为 `Optimized pipeline not found after creation`
- Pipeline run 失败：查看该轮 `jobId` 的 Job 和 traces
- Distillation 失败：查看该轮 `distillationId` 的 `result.error`
