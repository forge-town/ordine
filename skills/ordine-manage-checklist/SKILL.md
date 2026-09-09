---
name: ordine-manage-checklist
description: 管理 Ordine Best Practice 下的 Checklist Item 实体。
---

# 管理 Checklist Items

当前源码独立 Server 未挂载 Best Practice、Rule、Checklist Item、Code Snippet 接口；涉及这些资源时，先确认目标版本支持。历史示例不证明接口可用，404 后不要重复试探。

## 概述

Checklist Item 是 Best Practice 的子资源，每条代表一个 yes/no 可判定的检查项。通过 `bestPracticeId` 关联到其所属的 Best Practice。

## 通过 CLI

> CLI 当前不直接支持 Checklist Item CRUD。使用 REST API 操作。

## 通过 REST API

### 查看某个 Best Practice 的所有检查项

```bash
curl -s "http://localhost:9433/api/checklist-items?bestPracticeId=bp_classname_convention" | python3 -m json.tool
```

### 添加/更新检查项（PUT = upsert）

```bash
curl -X PUT http://localhost:9433/api/checklist-items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cli_cn_1",
    "bestPracticeId": "bp_classname_convention",
    "content": "所有动态 className 使用 cn() 函数",
    "sortOrder": 0
  }'
```

### 删除检查项

```bash
curl -X DELETE "http://localhost:9433/api/checklist-items?id=cli_cn_1"
```

### 批量添加

```bash
for i in 0 1 2; do
  curl -X PUT http://localhost:9433/api/checklist-items \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"cli_barrel_${i}\",
      \"bestPracticeId\": \"bp_barrel_export\",
      \"content\": \"检查项 ${i}\",
      \"sortOrder\": ${i}
    }"
done
```

## 数据结构

| 字段             | 类型     | 说明                             |
| ---------------- | -------- | -------------------------------- |
| `id`             | `string` | 唯一标识                         |
| `bestPracticeId` | `string` | 所属 Best Practice ID（必填）    |
| `content`        | `string` | 检查项描述（必须 yes/no 可判定） |
| `sortOrder`      | `number` | 排序序号（0 开始）               |

## 编写原则

- 每条必须是 **可判定的**（yes/no），不允许模糊描述
- ✅ "所有 className 使用 cn() 函数" — 可判定
- ❌ "代码风格良好" — 不可判定
- 排序从 0 开始，连续递增
- 检查项数量由实际约束决定，避免重复或为凑数添加条目
