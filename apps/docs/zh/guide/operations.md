# 操作

操作是 Ordine 中的原子执行单元。每个操作封装一个编码任务，并配置如何执行。

## 执行器类型

| 类型 | 说明 |
|------|------|
| `agent` | AI agent（Claude/Codex） |
| `script` | 自定义脚本 |
| `rule-check` | 策略验证 |

## Agent 模式

### 技能模式

使用注册的技能进行结构化执行。Agent 获取技能描述和工具集。

### 提示词模式

直接提示词传递给 AI agent，适用于不需要技能框架的简单任务。

## 创建操作

```sh
curl -X POST http://localhost:9433/api/operations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码审查",
    "description": "AI 驱动的代码审查",
    "executorType": "agent",
    "agentMode": "skill"
  }'
```

## 工具

操作可以访问以下工具：

| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入或创建文件 |
| `list_dir` | 列出目录内容 |
| `search_files` | 搜索文件 |
| `run_command` | 执行 shell 命令 |
