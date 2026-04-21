# ordine-browse-traces

Use when Pipeline 运行失败或结果异常，需要读取 Job 的 Trace 日志、分析错误原因并给出修复建议。触发词：browse traces、job失败、排查运行失败、trace日志、pipeline报错、job error。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-browse-traces
description: Use when Pipeline 运行失败或结果异常，需要读取 Job 的 Trace 日志、分析错误原因并给出修复建议。触发词：browse traces、job失败、排查运行失败、trace日志、pipeline报错、job error。
---

# 浏览 Trace 日志

## 概述

当 Pipeline 运行后 Job 状态变为 `failed` 或结果不符合预期时，需要通过 Trace 日志定位根因并给出修复方案。

## 诊断流程

### 第一步：获取 Job 状态

```bash
# 查看 Job 详情
curl -s http://localhost:9433/api/jobs/<JOB_ID> | python3 -m json.tool
```

关注字段：

| 字段 | 说明 |
|---|---|
| `status` | `failed` = 运行失败，`completed` = 已完成（可能有部分错误） |
| `error` | 顶层错误信息（如果有） |
| `result` | 运行结果摘要 |
| `startedAt` / `completedAt` | 计算运行耗时，判断是否超时 |

### 第二步：读取 Trace 日志

```bash
# 获取该 Job 的所有 Trace
curl -s http://localhost:9433/api/jobs/<JOB_ID>/traces | python3 -m json.tool
```

Trace 数据结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `number` | 自增 ID |
| `jobId` | `string` | 所属 Job ID |
| `level` | `"info" \| "warn" \| "error" \| "debug"` | 日志级别 |
| `message` | `string` | 日志内容 |
| `createdAt` | `timestamp` | 时间戳 |

### 第三步：按级别过滤分析

优先查看 `error` 级别的 Trace：

```bash
# 只看错误日志
curl -s http://localhost:9433/api/jobs/<JOB_ID>/traces | \
  python3 -c "import sys,json; [print(t['message']) for t in json.load(sys.stdin) if t['level']=='error']"
```

再查看 `warn` 级别了解潜在问题：

```bash
# 只看警告日志
curl -s http://localhost:9433/api/jobs/<JOB_ID>/traces | \
  python3 -c "import sys,json; [print(t['message']) for t in json.load(sys.stdin) if t['level']=='warn']"
```

### 第四步：常见失败模式

| 模式 | Trace 特征 | 修复方向 |
|---|---|---|
| Operation 执行失败 | `error` 消息包含 Operation ID | 检查该 Operation 的 executor 配置（script/skill/prompt） |
| 输入路径不存在 | `error` 消息包含 `ENOENT` 或 `not found` | 检查运行时传入的 `-i` 路径是否正确 |
| Skill 调用超时 | 长时间无新 Trace，最终 `failed` | 检查 Skill 服务是否在线，网络是否通畅 |
| 脚本权限不足 | `error` 消息包含 `EACCES` 或 `permission denied` | 检查脚本文件的执行权限 |
| 节点连接断裂 | `warn` 消息提示某节点未收到输入 | 检查 Pipeline DAG 中节点之间的连线 |

### 第五步：确认修复

修复问题后重新运行 Pipeline：

```bash
# 通过 CLI
ordine run <PIPELINE_ID> -i <INPUT_PATH>

# 通过 API
curl -X POST http://localhost:9433/api/pipelines/<PIPELINE_ID>/run \
  -H "Content-Type: application/json" \
  -d '{ "inputPath": "<INPUT_PATH>" }'
```

验证新 Job 状态为 `completed` 且无 `error` 级别 Trace。

```
