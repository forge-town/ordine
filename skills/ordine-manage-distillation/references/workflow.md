# Distillation 管理流程

## 运行前确认

先向用户确认：

- 目标动作：创建、运行、查看、更新或删除
- source 类型：`job`、`pipeline` 或 `manual`
- source ID：Job ID、Pipeline ID，或人工输入为空
- mode：`pipeline`、`failure`、`prompt` 或 `knowledge`
- objective：本次蒸馏要提取什么
- agent/model：是否使用默认设置，还是覆盖 agent 或 model

## 数据模型

核心字段：

- `id`：Distillation ID
- `title`：标题
- `summary`：人工摘要或上下文摘要
- `sourceType`：`job`、`pipeline`、`manual`
- `sourceId`：源对象 ID，manual 可为 `null`
- `sourceLabel`：源对象显示名
- `mode`：`pipeline`、`failure`、`prompt`、`knowledge`
- `status`：`draft`、`running`、`completed`、`failed`
- `config.objective`：目标
- `config.systemPrompt`：可选系统提示词
- `config.agent`：可选 agent runtime
- `config.model`：可选模型
- `inputSnapshot`：运行时生成或保留的输入快照
- `result`：运行结果，完成时包含 `summary`、`insights`、`minimalPath`、`reusableAssets`、`nextActions`

## REST API

默认 API 地址是 `http://localhost:9433`。

列出 Distillations：

```bash
curl -s http://localhost:9433/api/distillations | python3 -m json.tool
```

查看单个 Distillation：

```bash
curl -s http://localhost:9433/api/distillations/<distillation-id> | python3 -m json.tool
```

创建 draft：

```bash
curl -s -X POST http://localhost:9433/api/distillations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dst_example",
    "title": "Distill failed pipeline run",
    "summary": "",
    "sourceType": "job",
    "sourceId": "job_xxx",
    "sourceLabel": "Failed pipeline run",
    "mode": "failure",
    "status": "draft",
    "config": {
      "objective": "Extract the root cause, reusable failure pattern, and next actions."
    },
    "inputSnapshot": null,
    "result": null
  }' | python3 -m json.tool
```

更新：

```bash
curl -s -X PATCH http://localhost:9433/api/distillations/<distillation-id> \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Updated context",
    "config": {
      "objective": "Extract reusable pipeline improvement guidance."
    }
  }' | python3 -m json.tool
```

运行：

```bash
curl -s -X POST http://localhost:9433/api/distillations/<distillation-id>/run | python3 -m json.tool
```

删除：

```bash
curl -X DELETE http://localhost:9433/api/distillations/<distillation-id>
```

## 运行结果判断

运行 API 返回更新后的 Distillation，而不是 Job ID。确认：

- `status` 为 `completed` 或 `failed`
- `result.type` 为 `completed` 时读取 `summary`、`insights`、`minimalPath`、`reusableAssets`、`nextActions`
- `result.type` 为 `failed` 时读取 `error` 和 `raw`
- `inputSnapshot` 是否覆盖了预期来源

## 常见来源

Job 来源适合失败分析或运行复盘：

- `sourceType: "job"`
- `sourceId: "<job-id>"`
- `mode: "failure"` 或 `"pipeline"`

Pipeline 来源适合结构优化或模板提炼：

- `sourceType: "pipeline"`
- `sourceId: "<pipeline-id>"`
- `mode: "pipeline"`

Manual 来源适合直接粘贴上下文：

- `sourceType: "manual"`
- `sourceId: null`
- `summary` 填入上下文摘要
- `mode: "knowledge"` 或 `"prompt"`

## 排查

- 404：Distillation 不存在，先 `GET /api/distillations/<id>`
- `status: failed`：读取 `result.error` 和 `result.raw`
- 结果为空：检查 sourceId 是否存在、sourceType 是否正确、objective 是否足够具体
- Agent 失败：检查默认 agent runtime、API key、model 和服务日志
