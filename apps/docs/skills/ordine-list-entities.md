# ordine-list-entities

Use when 需要在 Ordine 系统中列出或发现已有的 Operation、Pipeline、Best Practice 等实体以复用，避免重复创建。触发词：list entities、列出operation、查找pipeline、有没有已有的、复用检查、发现实体。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-list-entities
description: Use when 需要在 Ordine 系统中列出或发现已有的 Operation、Pipeline、Best Practice 等实体以复用，避免重复创建。触发词：list entities、列出operation、查找pipeline、有没有已有的、复用检查、发现实体。
---

# 列出与发现实体

## 概述

在创建新的 Operation、Pipeline 或 Best Practice 之前，应先搜索系统中是否已存在可复用的实体。Ordine 的 REST API 提供全量列表接口，通过客户端过滤实现搜索。

## 搜索方法

### 搜索 Operation

```bash
# 列出所有 Operation
curl -s http://localhost:9433/api/operations | python3 -m json.tool

# 按名称关键词搜索（客户端过滤）
curl -s http://localhost:9433/api/operations | \
  python3 -c "
import sys, json
ops = json.load(sys.stdin)
keyword = 'lint'
for op in ops:
    if keyword.lower() in op['name'].lower() or keyword.lower() in (op.get('description') or '').lower():
        print(f\"{op['id']}: {op['name']} — {op.get('description', '')}\")" 
```

### 搜索 Pipeline

```bash
# 列出所有 Pipeline
curl -s http://localhost:9433/api/pipelines | python3 -m json.tool

# 按名称搜索
curl -s http://localhost:9433/api/pipelines | \
  python3 -c "
import sys, json
pipes = json.load(sys.stdin)
keyword = 'dao'
for p in pipes:
    if keyword.lower() in p['name'].lower() or keyword.lower() in (p.get('description') or '').lower():
        print(f\"{p['id']}: {p['name']} — {p.get('description', '')}\")"
```

### 搜索 Best Practice

```bash
# 列出所有 Best Practice
curl -s http://localhost:9433/api/best-practices | python3 -m json.tool

# 按名称或描述搜索
curl -s http://localhost:9433/api/best-practices | \
  python3 -c "
import sys, json
bps = json.load(sys.stdin)
keyword = 'naming'
for bp in bps:
    if keyword.lower() in bp['name'].lower() or keyword.lower() in (bp.get('description') or '').lower():
        print(f\"{bp['id']}: {bp['name']} — {bp.get('description', '')}\")"
```

### 搜索 Skill

```bash
# 列出所有 Skill
curl -s http://localhost:9433/api/skills | python3 -m json.tool
```

### 搜索 Recipe

```bash
# 列出所有 Recipe（Operation + Best Practice 绑定）
curl -s http://localhost:9433/api/recipes | python3 -m json.tool
```

## 复用策略

### 决策树

```
需要一个新的检查功能
  ├── 搜索 Operation：已有类似的？
  │     ├── 完全匹配 → 直接使用
  │     ├── 部分匹配 → 考虑修改现有 Operation 的配置
  │     └── 无匹配 → 创建新 Operation（参考 ordine-create-operation）
  │
  ├── 搜索 Best Practice：已有对应规范？
  │     ├── 完全匹配 → 直接绑定 Recipe
  │     └── 无匹配 → 创建新 Best Practice（参考 ordine-create-bestpractice）
  │
  └── 搜索 Pipeline：已有包含此检查的？
        ├── 匹配 → 直接运行
        └── 无匹配 → 创建或扩展 Pipeline（参考 ordine-create-pipeline）
```

### 查看实体详情

找到候选实体后，查看完整配置以确认是否满足需求：

```bash
# 查看 Operation 详情（含 executor 配置、输入输出端口）
curl -s http://localhost:9433/api/operations/<OP_ID> | python3 -m json.tool

# 查看 Pipeline 详情（含 DAG 节点和连线）
curl -s http://localhost:9433/api/pipelines/<PIPELINE_ID> | python3 -m json.tool

# 查看 Best Practice 详情
curl -s http://localhost:9433/api/best-practices/<BP_ID> | python3 -m json.tool

# 查看 Best Practice 的 Checklist
curl -s "http://localhost:9433/api/checklist-items?bestPracticeId=<BP_ID>" | python3 -m json.tool

# 查看 Best Practice 的 Code Snippets
curl -s "http://localhost:9433/api/code-snippets?bestPracticeId=<BP_ID>" | python3 -m json.tool
```

## 注意事项

- 搜索在客户端执行，所有 `GET /api/<resource>` 返回全量数据
- 搜索时建议同时匹配 `name` 和 `description` 字段
- Pipeline 的 `config` 字段包含完整 DAG 定义（JSON），可进一步解析查看包含的 Operation 节点

```
