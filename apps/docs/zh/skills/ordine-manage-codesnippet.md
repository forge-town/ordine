# ordine-manage-codesnippet

Use when 需要为 Best Practice 添加、更新或删除 Code Snippets（代码片段），提供正确/错误用法的具体代码示例。触发词：管理代码片段、添加code snippet、创建示例代码、编辑代码示例。

## Skill 内容

复制以下内容并提供给你的 AI agent：

```markdown
---
name: ordine-manage-codesnippet
description: Use when 需要为 Best Practice 添加、更新或删除 Code Snippets（代码片段），提供正确/错误用法的具体代码示例。触发词：管理代码片段、添加code snippet、创建示例代码、编辑代码示例。
---

# 管理 Code Snippets

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

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `bestPracticeId` | `string` | 所属 Best Practice ID（必填） |
| `title` | `string \| null` | 片段标题（如 "✅ 正确用法"） |
| `code` | `string` | 代码内容 |
| `language` | `string \| null` | 代码语言：`typescript`, `tsx`, `bash`, `json` 等 |
| `sortOrder` | `number` | 排序序号（0 开始） |

## 编写原则

- 至少提供一个 Good 示例和一个 Bad 示例
- `title` 用 ✅/❌ emoji 标识正误
- 代码必须语法正确、可直接使用
- 按 sortOrder 排序：Good 在前，Bad 在后
- `language` 字段便于前端语法高亮

```
