# 运行 Operation 指南

## 运行前确认

运行前从请求、当前配置和已知上下文核实以下信息；仅在关键项缺失或执行授权不足时询问：

- Operation ID：例如 `op_scan_schema`
- API 地址：默认 `http://localhost:9433`
- 输入方式：`inputPath`、`inputContent` 或空输入
- Agent runtime 覆盖：是否传 `agentOverride`
- 预期输出：Job ID、Job 终态、traces、生成的文件或结果目录

沿用用户已有执行授权；常规参数不逐项重复确认。目标环境、输入或执行副作用有实质变化时再澄清。

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

轮询只查询返回的 Job ID，不重复提交运行。按预计时长选择查询间隔；到 `done`、`failed`、`cancelled`、`expired`、`skipped` 停止，到 `paused` 检查暂停原因。连续查询失败时先诊断连接或鉴权，避免无限循环。

## Job 状态

当前 Operation runner 会创建 `operation_run` 类型 Job，并使用这些主要状态：

- `queued`：已创建，等待后台执行
- `running`：正在执行
- `done`：执行成功
- `failed`：执行失败，查看 `error` 和 traces
- `cancelled` 或 `expired`：运行被取消或超时

## 输入与产物

Operation 的 ID 和输入输出约定取自目标实例；本地路径使用当前任务核实的绝对路径，不沿用他人机器的路径。成功后读取实际输出，核对内容与本次运行的来源；只返回 Job ID 或声明生成文件不等于交付。

## 失败排查

- 404 `Operation not found`：先用 `GET /api/operations/<operation-id>` 确认数据库记录存在
- Job `failed`：读取 `GET /api/jobs/<job-id>/traces`
- 无输出文件：确认 Operation executor 是否实际写入 `.ordine/results` 或只返回文本结果
- 输入不匹配：检查 `acceptedObjectTypes`，folder 类型应传绝对目录路径
- Agent 失败：检查默认 runtime、API key、SSH runtime 配置和 agent raw exports
