# 运行 Pipeline 指南

## 通过 CLI 运行（推荐）

### 环境配置

```bash
# 设置 API 地址（默认 http://localhost:3000）
export ORDINE_API_URL=http://localhost:9433
```

### 列出可运行的 Pipeline

```bash
ordine pipelines
# 或
ordine ls
```

输出示例：

```
  Pipelines (3):

  pipe_multi_quality_check  多项质量检查 [check, quality]
    并发执行 DAO、ClassName、Barrel Export 三项检查
  pipe_check_dao  检查 DAO 规范 [check, dao]
  pipe_check_fix_store  检查+修复 Store [check, fix, store]
```

### 运行 Pipeline

```bash
# 运行并自动轮询状态（默认行为）
ordine run pipe_multi_quality_check

# 指定输入路径
ordine run pipe_check_dao -i ./packages/models/src/daos

# 不等待完成（fire and forget）
ordine run pipe_check_dao --no-follow
```

CLI 会自动：
1. 触发 Pipeline → 获取 Job ID
2. 每 3 秒轮询 Job 状态
3. 实时打印 Job 日志
4. 完成时显示 Summary 或打印错误信息

### 运行输出示例

```
Triggering pipeline pipe_check_dao...
Job created: job_abc123
[check] Scanning DAO files...
[check] Found 5 violations in 3 files
[check] Report saved to .ordine/results/dao-report.md

Pipeline completed in 12s
  Summary: 5 violations found
```

## 通过 REST API 运行

### 1. 触发 Pipeline 运行

```bash
curl -X POST http://localhost:9433/api/pipelines/<pipeline-id>/run \
  -H "Content-Type: application/json"
```

返回：

```json
{
  "jobId": "job_xxxxxxxx"
}
```

### 2. 查看 Job 状态

```bash
curl -s http://localhost:9433/api/jobs/<job-id> | python3 -m json.tool
```

返回示例：

```json
{
  "id": "job_xxxxxxxx",
  "pipelineId": "pipe_multi_quality_check",
  "status": "running",
  "result": null,
  "startedAt": "2025-01-15T10:00:00Z",
  "completedAt": null,
  "createdAt": "2025-01-15T10:00:00Z"
}
```

### 3. 轮询直到完成

```bash
# 简单轮询脚本
JOB_ID="job_xxxxxxxx"
while true; do
  STATUS=$(curl -s http://localhost:9433/api/jobs/$JOB_ID | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 2
done

# 查看最终结果
curl -s http://localhost:9433/api/jobs/$JOB_ID | python3 -m json.tool
```

## Job 状态流转

```
pending → running → completed
                  → failed
```

| 状态 | 含义 |
|---|---|
| `pending` | 已创建，等待执行 |
| `running` | 正在执行 |
| `completed` | 执行成功 |
| `failed` | 执行失败 |

## 查看 Job 列表

```bash
# 查看所有 Job
curl -s http://localhost:9433/api/jobs | python3 -m json.tool

# 按状态过滤
curl -s "http://localhost:9433/api/jobs?status=running" | python3 -m json.tool
curl -s "http://localhost:9433/api/jobs?status=failed" | python3 -m json.tool

# 按 Pipeline 过滤（通过 workId）
curl -s "http://localhost:9433/api/jobs?workId=<work-id>" | python3 -m json.tool
```

## 删除 Job

```bash
curl -X DELETE http://localhost:9433/api/jobs/<job-id>
```

## 运行前检查

在运行 Pipeline 之前，确认：

1. **Pipeline 存在且配置正确**
   ```bash
   curl -s http://localhost:9433/api/pipelines/<pipeline-id> | python3 -m json.tool
   ```

2. **Pipeline 中引用的 Operation 都存在**
   ```bash
   # 检查 pipeline 的 nodes，找到 type=operation 的节点
   # 确认其 data.operationId 对应的 Operation 存在
   curl -s http://localhost:9433/api/operations/<operation-id> | python3 -m json.tool
   ```

3. **Operation 引用的 Skill 存在**
   ```bash
   curl -s http://localhost:9433/api/skills/<skill-id> | python3 -m json.tool
   ```

## 完整运行示例

```bash
# 1. 确认 Pipeline
curl -s http://localhost:9433/api/pipelines/pipe_multi_quality_check | python3 -m json.tool

# 2. 运行
JOB_ID=$(curl -s -X POST http://localhost:9433/api/pipelines/pipe_multi_quality_check/run | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])")
echo "Job started: $JOB_ID"

# 3. 等待完成
sleep 5
curl -s http://localhost:9433/api/jobs/$JOB_ID | python3 -m json.tool
```
