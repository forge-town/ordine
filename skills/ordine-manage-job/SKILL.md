---
name: ordine-manage-job
description: Use when 需要在 Ordine 系统中查看、过滤或管理 Job（运行记录），包括查看运行状态、日志和结果。触发词：查看job、job状态、运行记录、管理作业、查看运行历史。
---

# 管理 Job

## 概述

Job 是 Pipeline 的一次运行记录，包含状态、日志和结果。当你通过 CLI `ordine run` 或 REST API `POST /api/pipelines/:id/run` 触发 Pipeline 时，会创建一个 Job。

## 通过 CLI 管理

### 运行并自动跟踪 Job

```bash
# 运行 Pipeline 会自动 follow Job
ordine run pipe_check_dao -i ./src

# 不等待完成
ordine run pipe_check_dao --no-follow
```

CLI `run` 命令会自动轮询 Job 状态（每 3 秒），实时打印日志，直到 `done`/`failed`/`cancelled`。

## 通过 REST API 管理

```bash
# 列出所有 Job
curl -s http://localhost:9431/api/jobs | python3 -m json.tool

# 按状态过滤
curl -s "http://localhost:9431/api/jobs?status=running" | python3 -m json.tool
curl -s "http://localhost:9431/api/jobs?status=failed" | python3 -m json.tool

# 按 Work 过滤
curl -s "http://localhost:9431/api/jobs?workId=work_xxx" | python3 -m json.tool

# 按项目过滤
curl -s "http://localhost:9431/api/jobs?projectId=proj_xxx" | python3 -m json.tool

# 查看单个 Job 详情（含日志和结果）
curl -s http://localhost:9431/api/jobs/job_xxx | python3 -m json.tool

# 创建 Job（通常由 Pipeline run 自动创建）
curl -X POST http://localhost:9431/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "job_manual_001",
    "pipelineId": "pipe_check_dao",
    "status": "pending"
  }'

# 更新 Job 状态
curl -X PATCH http://localhost:9431/api/jobs/job_manual_001 \
  -H "Content-Type: application/json" \
  -d '{ "status": "running" }'

# 删除 Job
curl -X DELETE http://localhost:9431/api/jobs/job_manual_001
```

## 数据结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `pipelineId` | `string \| null` | 关联的 Pipeline ID |
| `workId` | `string \| null` | 关联的 Work ID |
| `projectId` | `string \| null` | 关联的项目 ID |
| `status` | `JobStatus` | 状态：`pending`, `running`, `completed`, `failed` |
| `result` | `JSON \| null` | 运行结果（summary, output 等） |
| `error` | `string \| null` | 错误信息 |
| `startedAt` | `timestamp \| null` | 开始时间 |
| `completedAt` | `timestamp \| null` | 完成时间 |
| `createdAt` | `timestamp` | 创建时间 |

## Job 状态流转

```
pending → running → completed
                  → failed
```

## 常见任务

### 查看最近失败的 Job

```bash
curl -s "http://localhost:9431/api/jobs?status=failed" | python3 -c "
import sys, json
jobs = json.load(sys.stdin)
for j in jobs:
    print(f\"{j['id']}  pipeline={j.get('pipelineId')}  error={j.get('error','(none)')}\")
"
```

### 清理历史 Job

```bash
# 列出所有 completed 的 Job，逐个删除
curl -s "http://localhost:9431/api/jobs?status=completed" | python3 -c "
import sys, json
for j in json.load(sys.stdin):
    print(j['id'])
" | while read id; do
  curl -X DELETE "http://localhost:9431/api/jobs/$id"
done
```
