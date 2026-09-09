---
name: ordine-manage-job
description: 查看、过滤或删除 Ordine Job 运行记录。
---

# 管理 Job

## 概述

Job 是 Pipeline 的一次运行记录，包含状态、日志和结果。当你通过 CLI `ordine run` 或 REST API `POST /api/pipelines/:id/run` 触发 Pipeline 时，会创建一个 Job。

## 通过 CLI 管理

### 运行并自动跟踪 Job

```bash
# Agent 读取所有 Job
ordine --json jobs list

# Agent 读取单个 Job 与 Trace
ordine --json jobs get <JOB_ID>
ordine --json jobs traces <JOB_ID>

# 运行 Pipeline 会自动 follow Job
ordine run pipe_check_dao -i ./src

# 不等待完成
ordine run pipe_check_dao --no-follow
```

CLI `run` 默认跟踪 Job；`done` 返回成功，`paused`、`failed`、`cancelled`、`expired`、`skipped` 停止跟踪并返回非零。查询已有 Job 时不要新建运行。

## 通过 REST API 管理

```bash
# 列出所有 Job
curl -s http://localhost:9433/api/jobs | python3 -m json.tool

# 按状态过滤
curl -s "http://localhost:9433/api/jobs?status=running" | python3 -m json.tool
curl -s "http://localhost:9433/api/jobs?status=failed" | python3 -m json.tool

# 按项目过滤
curl -s "http://localhost:9433/api/jobs?projectId=proj_xxx" | python3 -m json.tool

# 查看单个 Job 详情（含日志和结果）
curl -s http://localhost:9433/api/jobs/job_xxx | python3 -m json.tool

# 删除 Job
curl -X DELETE http://localhost:9433/api/jobs/job_manual_001
```

## 数据结构

| 字段          | 类型                | 说明                                                                                     |
| ------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `id`          | `string`            | 唯一标识                                                                                 |
| `pipelineId`  | `string \| null`    | 关联的 Pipeline ID                                                                       |
| `projectId`   | `string \| null`    | 关联的项目 ID                                                                            |
| `status`      | `JobStatus`         | 状态：`queued`, `running`, `paused`, `done`, `failed`, `cancelled`, `expired`, `skipped` |
| `result`      | `JSON \| null`      | 运行结果（summary, output 等）                                                           |
| `error`       | `string \| null`    | 错误信息                                                                                 |
| `startedAt`   | `timestamp \| null` | 开始时间                                                                                 |
| `completedAt` | `timestamp \| null` | 完成时间                                                                                 |
| `createdAt`   | `timestamp`         | 创建时间                                                                                 |

## Job 状态流转

```
queued → running ↔ paused
           ├→ done
           ├→ failed
           ├→ cancelled
           ├→ expired
           └→ skipped
```

## 常见任务

### 查看最近失败的 Job

```bash
curl -s "http://localhost:9433/api/jobs?status=failed" | python3 -c "
import sys, json
jobs = json.load(sys.stdin)
for j in jobs:
    print(f\"{j['id']}  pipeline={j.get('pipelineId')}  error={j.get('error','(none)')}\")
"
```

### 清理历史 Job

仅删除用户明确要求清理、且已核实 ID 和范围的记录。先列出匹配项，再删除这些确切 ID；不要默认删除所有 `done` 记录。Job 状态由运行服务管理，不能手改状态冒充执行成功。
