# ordine-export-import

Use when 需要导出或导入 Ordine 的 Best Practice 数据（含 checklistItems 和 codeSnippets），用于备份、迁移或共享。触发词：导出最佳实践、导入规范、迁移数据、备份bestpractice、export import。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-export-import
description: Use when 需要导出或导入 Ordine 的 Best Practice 数据（含 checklistItems 和 codeSnippets），用于备份、迁移或共享。触发词：导出最佳实践、导入规范、迁移数据、备份bestpractice、export import。
---

# 导出与导入

## 概述

Ordine 支持将 Best Practice（连同关联的 Checklist Items 和 Code Snippets）批量导出为 JSON 文件，以及从 JSON 文件导入。适用于数据备份、环境迁移和团队共享。

## 通过 CLI

> CLI 当前不直接支持导出导入。使用 REST API 操作。

## 通过 REST API

### 导出所有 Best Practice

```bash
# 导出到文件
curl -s http://localhost:9433/api/best-practices/export > best-practices-export.json

# 预览导出内容
curl -s http://localhost:9433/api/best-practices/export | python3 -m json.tool
```

导出格式：

```json
[
  {
    "id": "bp_classname_convention",
    "title": "className 使用 cn() 函数",
    "condition": "当组件中使用 className 动态拼接时",
    "content": "所有动态 className 必须使用 cn() 工具函数",
    "codeSnippet": "...",
    "category": "style",
    "language": "react",
    "tags": ["className", "tailwind"],
    "checklistItems": [
      { "id": "cli_cn_1", "content": "所有动态 className 使用 cn()", "sortOrder": 0 }
    ],
    "codeSnippets": [
      { "id": "cs_cn_good", "title": "✅ 正确用法", "code": "...", "language": "tsx", "sortOrder": 0 }
    ]
  }
]
```

### 导入 Best Practice

```bash
# 从文件导入
curl -X POST http://localhost:9433/api/best-practices/import \
  -H "Content-Type: application/json" \
  -d @best-practices-export.json
```

返回导入统计：

```json
{
  "imported": {
    "bestPractices": 5,
    "checklistItems": 12,
    "codeSnippets": 8
  }
}
```

### 典型工作流

#### 备份

```bash
# 定期备份
DATE=$(date +%Y%m%d)
curl -s http://localhost:9433/api/best-practices/export > "backups/bp-${DATE}.json"
```

#### 环境迁移

```bash
# 从开发环境导出
ORDINE_API_URL=http://localhost:9433 \
  curl -s http://localhost:9433/api/best-practices/export > bp-export.json

# 导入到生产环境
curl -X POST http://production-server:9433/api/best-practices/import \
  -H "Content-Type: application/json" \
  -d @bp-export.json
```

#### 团队共享

将导出的 JSON 文件提交到仓库，团队成员各自导入：

```bash
# 从仓库中的共享文件导入
curl -X POST http://localhost:9433/api/best-practices/import \
  -H "Content-Type: application/json" \
  -d @shared/best-practices.json
```

```
