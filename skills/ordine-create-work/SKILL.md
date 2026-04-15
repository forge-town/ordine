---
name: ordine-create-work
description: Use when 需要在 Ordine 系统中创建 Work（工作单元），Work 代表一次面向特定项目的工作任务，下属多个 Job。触发词：创建工作、新建work、创建项目任务、添加工作单元。
---

# 创建 Work

## 概述

Work 是 Ordine 中的工作任务单元，关联到特定项目（projectId）。一个 Work 下可以有多个 Job（由 Pipeline 运行产生）。

## 快速参考

### CLI

> CLI 当前不直接支持 Work CRUD。使用 REST API 操作。

### REST API

```bash
# 列出所有
curl -s http://localhost:9433/api/works | python3 -m json.tool

# 按项目过滤
curl -s "http://localhost:9433/api/works?projectId=proj_001" | python3 -m json.tool

# 查看单个
curl -s http://localhost:9433/api/works/work_xxx | python3 -m json.tool

# 创建
curl -X POST http://localhost:9433/api/works \
  -H "Content-Type: application/json" \
  -d '{
    "id": "work_quality_review_20250115",
    "name": "2025-01-15 质量审查",
    "description": "对项目进行全面的代码质量审查",
    "projectId": "proj_ordine"
  }'

# 更新状态
curl -X PATCH http://localhost:9433/api/works/work_quality_review_20250115 \
  -H "Content-Type: application/json" \
  -d '{ "status": "completed" }'

# 删除
curl -X DELETE http://localhost:9433/api/works/work_quality_review_20250115
```

## 数据结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `name` | `string` | 工作名称 |
| `description` | `string \| null` | 工作描述 |
| `projectId` | `string \| null` | 所属项目 ID |
| `status` | `string \| null` | 工作状态 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## Work → Job 关系

```
Work (工作任务)
  └── Job 1 (Pipeline A 的一次运行)
  └── Job 2 (Pipeline B 的一次运行)
  └── Job 3 (Pipeline A 的第二次运行)
```

Job 通过 `workId` 关联到 Work。查看某个 Work 下的所有 Job：

```bash
curl -s "http://localhost:9433/api/jobs?workId=work_quality_review_20250115" | python3 -m json.tool
```

## 命名规范

- ID: `work_<描述>_<日期或序号>` — 如 `work_quality_review_20250115`, `work_sprint_12`
