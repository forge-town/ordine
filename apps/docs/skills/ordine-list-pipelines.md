# ordine-list-pipelines

Use when 需要列出 Ordine 中所有 Pipeline，查看可用的流水线及其概要信息。触发词：列出pipeline、查看所有流水线、显示pipeline列表、有哪些pipeline。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-list-pipelines
description: Use when 需要列出 Ordine 中所有 Pipeline，查看可用的流水线及其概要信息。触发词：列出pipeline、查看所有流水线、显示pipeline列表、有哪些pipeline。
---

# 列出 Pipeline

## 通过 CLI（推荐）

```bash
# 设置 API 地址
export ORDINE_API_URL=http://localhost:9433

# 列出所有 Pipeline
ordine pipelines

# 或使用别名
ordine ls
```

输出格式：

```
  Pipelines (3):

  pipe_multi_quality_check  多项质量检查 [check, quality]
    并发执行 DAO、ClassName、Barrel Export 三项检查
  pipe_check_dao  检查 DAO 规范 [check, dao]
  pipe_check_fix_store  检查+修复 Store [check, fix, store]
```

## 通过 REST API

```bash
# 列出所有
curl -s http://localhost:9433/api/pipelines | python3 -m json.tool

# 简洁格式
curl -s http://localhost:9433/api/pipelines | python3 -c "
import sys, json
for p in json.load(sys.stdin):
    tags = ', '.join(p.get('tags', []))
    print(f\"{p['id']}  {p['name']}  [{tags}]\")
"

# 查看单个 Pipeline 的详细结构（含 nodes 和 edges）
curl -s http://localhost:9433/api/pipelines/pipe_multi_quality_check | python3 -m json.tool
```

```
