---
name: ordine-manage-codesnippet
description: 管理 Ordine Best Practice 下的 Code Snippet 实体。
---

# 管理 Code Snippets

当前源码独立 Server 未挂载 Best Practice、Rule、Checklist Item、Code Snippet 接口；涉及这些资源时，先确认目标版本支持。历史示例不证明接口可用，404 后不要重复试探。

## 概述

Code Snippet 是 Best Practice 的子资源，提供详细的代码示例（正确用法、错误用法、边界情况等）。通过 `bestPracticeId` 关联到所属的 Best Practice。

## 通过 CLI

> CLI 当前不直接支持 Code Snippet CRUD。使用 REST API 操作。

## 通过 REST API

### 查看某个 Best Practice 的所有代码片段

```bash
curl -s "http://localhost:9433/api/code-snippets?bestPracticeId=bp_classname_convention" | python3 -m json.tool
```

### 添加/更新代码片段（PUT = upsert）

```bash
curl -X PUT http://localhost:9433/api/code-snippets \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cs_cn_good",
    "bestPracticeId": "bp_classname_convention",
    "title": "✅ 正确用法 — cn() 函数",
    "code": "import { cn } from \"@/lib/utils\"\n\nexport function Button({ variant, className }) {\n  return (\n    <button className={cn(\n      \"px-4 py-2 rounded\",\n      variant === \"primary\" && \"bg-blue-500 text-white\",\n      className\n    )} />\n  )\n}",
    "language": "tsx",
    "sortOrder": 0
  }'
```

### 删除代码片段

```bash
curl -X DELETE "http://localhost:9433/api/code-snippets?id=cs_cn_good"
```

## 数据结构

| 字段             | 类型             | 说明                                             |
| ---------------- | ---------------- | ------------------------------------------------ |
| `id`             | `string`         | 唯一标识                                         |
| `bestPracticeId` | `string`         | 所属 Best Practice ID（必填）                    |
| `title`          | `string \| null` | 片段标题（如 "✅ 正确用法"）                     |
| `code`           | `string`         | 代码内容                                         |
| `language`       | `string \| null` | 代码语言：`typescript`, `tsx`, `bash`, `json` 等 |
| `sortOrder`      | `number`         | 排序序号（0 开始）                               |

## 编写原则

- 提供能解释规则的必要示例；只有对比能澄清误用时才补充 Bad 示例
- `title` 清楚标识示例意图
- 代码必须语法正确、可直接使用
- 按 sortOrder 排序：Good 在前，Bad 在后
- `language` 字段便于前端语法高亮
