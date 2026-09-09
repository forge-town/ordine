---
name: ordine-list-entities
description: 在 Ordine 中按名称或用途查找已有实体，评估能否复用。
---

# 列出与发现实体

当前源码独立 Server 未挂载 Best Practice、Rule、Checklist Item、Code Snippet 接口；涉及这些资源时，先确认目标版本支持。历史示例不证明接口可用，404 后不要重复试探。

## 概述

用户要求查找或复用、或创建时有实际重名风险，才检索对应资源。目标 ID 已明确时直接读取详情；不要依次扫描所有实体类型。只输出匹配候选的必要字段。

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

## 复用策略

找到满足输入输出约束的候选后复用；部分匹配时比较修改对现有使用方的影响。发现结果不自动授权修改或运行。

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

- 对不支持服务端过滤的接口，在客户端过滤；注意目标版本的分页，避免把完整列表反复输出到上下文
- 搜索时建议同时匹配 `name` 和 `description` 字段
- Pipeline 的 `config` 字段包含完整 DAG 定义（JSON），可进一步解析查看包含的 Operation 节点
