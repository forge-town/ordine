# 任务

任务跟踪流水线运行的执行。每次运行流水线都会创建一个任务。

## 生命周期

```
queued → running → done
                 → failed
```

| 状态 | 说明 |
|------|------|
| `queued` | 已创建，等待执行 |
| `running` | 正在执行中 |
| `done` | 成功完成 |
| `failed` | 执行失败 |

## 任务结构

```json
{
  "id": "job_abc123",
  "pipelineId": "pipe_xyz",
  "status": "running",
  "createdAt": "2024-01-01T00:00:00Z",
  "startedAt": "2024-01-01T00:00:01Z",
  "finishedAt": null,
  "output": null
}
```

## 任务类型

- **流水线任务** — 执行完整流水线
- **操作任务** — 执行单个操作

## 监控

### 通过 UI

Web 应用的任务页面提供实时状态更新，包括：

- 当前执行状态
- 已执行时间
- 各节点执行进度
- 输出预览

### 通过 API

```sh
# 获取任务状态
curl http://localhost:9433/api/jobs/:id

# 获取所有任务
curl http://localhost:9433/api/jobs
```

## 追踪

每个任务记录详细的执行追踪，包括：

- 每个节点的开始/结束时间
- 输入和输出数据
- 错误信息（如有）
- Agent 交互日志
