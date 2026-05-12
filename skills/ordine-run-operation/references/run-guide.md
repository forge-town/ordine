# 运行 Operation 指南

## 运行前确认

在真正触发 Operation 前，先向用户确认以下信息：

- Operation ID：例如 `op_scan_schema`
- API 地址：默认 `http://localhost:9433`
- 输入方式：`inputPath`、`inputContent` 或空输入
- Agent runtime 覆盖：是否传 `agentOverride`
- 预期输出：Job ID、Job 终态、traces、生成的文件或结果目录

如果用户已经明确授权运行，仍然先说明将执行的命令和预期输出，再执行命令。

## 确认 Operation 存在

```bash
curl -s http://localhost:9433/api/operations/<operation-id> | python3 -m json.tool
```

确认重点：

- `id` 与用户指定一致
- `acceptedObjectTypes` 与输入类型匹配
- `config.executor.type` 是 `agent`、`script` 或其他可执行类型
- `config.outputs` 列出预期输出项

## 触发 Operation

使用文件或文件夹路径作为输入：

```bash
curl -s -X POST http://localhost:9433/api/operations/<operation-id>/run \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/absolute/path/to/input"
  }' | python3 -m json.tool
```

使用文本内容作为输入：

```bash
curl -s -X POST http://localhost:9433/api/operations/<operation-id>/run \
  -H "Content-Type: application/json" \
  -d '{
    "inputContent": "content to process"
  }' | python3 -m json.tool
```

指定 Agent runtime：

```bash
curl -s -X POST http://localhost:9433/api/operations/<operation-id>/run \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/absolute/path/to/input",
    "agentOverride": "codex"
  }' | python3 -m json.tool
```

成功响应为 HTTP 202，形状如下：

```json
{
  "jobId": "job-id"
}
```

## 监控 Job

查看 Job：

```bash
curl -s http://localhost:9433/api/jobs/<job-id> | python3 -m json.tool
```

查看 traces：

```bash
curl -s http://localhost:9433/api/jobs/<job-id>/traces | python3 -m json.tool
```

轮询直到终态：

```bash
JOB_ID="<job-id>"
while true; do
  STATUS=$(curl -s "http://localhost:9433/api/jobs/$JOB_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Status: $STATUS"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "cancelled" ] || [ "$STATUS" = "expired" ]; then
    break
  fi
  sleep 3
done
curl -s "http://localhost:9433/api/jobs/$JOB_ID" | python3 -m json.tool
```

## Job 状态

当前 Operation runner 会创建 `operation_run` 类型 Job，并使用这些主要状态：

- `queued`：已创建，等待后台执行
- `running`：正在执行
- `done`：执行成功
- `failed`：执行失败，查看 `error` 和 traces
- `cancelled` 或 `expired`：运行被取消或超时

## 运行 `op_scan_schema`

`op_scan_schema` 是数据库中的 Operation，不来自 `skills/` 静态目录。运行前先确认：

```bash
curl -s http://localhost:9433/api/operations/op_scan_schema | python3 -m json.tool
```

它接受 `folder` 输入。扫描当前项目 schema 时，推荐输入：

```bash
/Users/amin/projects/ordine/packages/db-schema/src
```

触发命令：

```bash
curl -s -X POST http://localhost:9433/api/operations/op_scan_schema/run \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/Users/amin/projects/ordine/packages/db-schema/src"
  }' | python3 -m json.tool
```

预期输出：

- 返回一个 `jobId`
- Job title 类似 `Run operation: 扫描 Schema 报告`
- Job 最终状态应为 `done` 或 `failed`
- Operation 期望生成 `report.md`、`dashboard`、`data` 三类输出
- 结果通常可通过 Job 详情、traces 或 `.ordine/results` 下的新文件定位

## 失败排查

- 404 `Operation not found`：先用 `GET /api/operations/<operation-id>` 确认数据库记录存在
- Job `failed`：读取 `GET /api/jobs/<job-id>/traces`
- 无输出文件：确认 Operation executor 是否实际写入 `.ordine/results` 或只返回文本结果
- 输入不匹配：检查 `acceptedObjectTypes`，folder 类型应传绝对目录路径
- Agent 失败：检查默认 runtime、API key、SSH runtime 配置和 agent raw exports
