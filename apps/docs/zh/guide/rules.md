# 规则

规则定义在特定事件发生时自动触发流水线执行的策略。

## 结构

```json
{
  "name": "PR 代码审查",
  "description": "在 Pull Request 创建时自动运行代码审查流水线",
  "trigger": "on-change",
  "pipelineId": "pipe_abc123"
}
```

## 创建规则

```sh
curl -X POST http://localhost:9433/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "自动审查",
    "description": "代码变更时触发审查",
    "pipelineId": "pipe_abc123"
  }'
```

## 触发类型

规则可以配置不同的触发条件：

- **代码变更** — 文件修改时触发
- **手动** — 通过 UI 或 API 手动触发
- **定时** — 按计划执行
