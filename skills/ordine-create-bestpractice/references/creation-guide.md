# 创建 Best Practice 指南

## 通过 CLI

> CLI 当前不直接支持 Best Practice CRUD。使用 REST API 操作。

## 通过 REST API 创建

### 1. 创建 Best Practice

```bash
curl -X POST http://localhost:9433/api/best-practices \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bp_barrel_export",
    "title": "桶导出规范",
    "condition": "当创建或审查 index.ts/index.js 文件时",
    "content": "所有 index 文件只做 re-export，不包含业务逻辑。使用命名导出，不使用默认导出。",
    "codeSnippet": "// ✅ Good\nexport { MyComponent } from \"./MyComponent\"\nexport { useMyHook } from \"./useMyHook\"\n\n// ❌ Bad\nexport default function() { /* 业务逻辑 */ }",
    "category": "structure",
    "language": "typescript",
    "tags": ["barrel", "export", "index"]
  }'
```

### 2. 添加 Checklist Items

```bash
curl -X PUT http://localhost:9433/api/checklist-items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cli_barrel_1",
    "bestPracticeId": "bp_barrel_export",
    "content": "index 文件只包含 re-export 语句",
    "sortOrder": 0
  }'

curl -X PUT http://localhost:9433/api/checklist-items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cli_barrel_2",
    "bestPracticeId": "bp_barrel_export",
    "content": "使用命名导出而非默认导出",
    "sortOrder": 1
  }'
```

### 3. 添加 Code Snippets

```bash
curl -X PUT http://localhost:9433/api/code-snippets \
  -H "Content-Type: application/json" \
  -d '{
    "id": "cs_barrel_good",
    "bestPracticeId": "bp_barrel_export",
    "title": "✅ 标准桶导出",
    "code": "export { Button } from \"./Button\"\nexport { Input } from \"./Input\"\nexport type { ButtonProps } from \"./Button\"",
    "language": "typescript",
    "sortOrder": 0
  }'
```

### 4. 查看完整 Best Practice（含关联数据）

```bash
# 列出所有
curl -s http://localhost:9433/api/best-practices | python3 -m json.tool

# 查看单个
curl -s http://localhost:9433/api/best-practices/bp_barrel_export | python3 -m json.tool

# 查看其 checklist items
curl -s "http://localhost:9433/api/checklist-items?bestPracticeId=bp_barrel_export" | python3 -m json.tool

# 查看其 code snippets
curl -s "http://localhost:9433/api/code-snippets?bestPracticeId=bp_barrel_export" | python3 -m json.tool
```

### 5. 导出 / 导入

```bash
# 导出所有 Best Practice（含 checklistItems + codeSnippets）
curl -s http://localhost:9433/api/best-practices/export | python3 -m json.tool > best-practices-export.json

# 导入
curl -X POST http://localhost:9433/api/best-practices/import \
  -H "Content-Type: application/json" \
  -d @best-practices-export.json
```

## 创建步骤

### Step 1: 定义规范边界

明确这条最佳实践回答的核心问题：
- **什么时候**触发？→ 填写 `condition`
- **怎么做**？→ 填写 `content`
- **属于哪类**？→ 选择 `category`

### Step 2: 编写内联代码片段

在 `codeSnippet` 中提供一个简短的 Good/Bad 对比示例。

### Step 3: 添加 Checklist Items

将规范拆解为可逐条验证的检查项，每项必须是 yes/no 可判定的：
- ✅ "所有 className 使用 cn() 函数" — 可判定
- ❌ "代码风格良好" — 不可判定

### Step 4: 添加详细 Code Snippets

对于复杂场景，添加多个 Code Snippet，涵盖：
- 正确用法
- 错误用法
- 边界情况

### Step 5: 绑定到 Recipe（可选）

如果有对应的 Operation 可以自动检查/修复此规范，创建 Recipe 绑定。

## 命名规范

| ID 格式 | 说明 | 示例 |
|---|---|---|
| `bp_<noun>_<detail>` | Best Practice | `bp_classname_convention`, `bp_barrel_export` |
| `cli_<bp_short>_<n>` | Checklist Item | `cli_cn_1`, `cli_barrel_1` |
| `cs_<bp_short>_<label>` | Code Snippet | `cs_cn_good`, `cs_barrel_bad` |

## 最佳实践的最佳实践

1. **一条规范只管一件事** — 不要在一个 BP 里混合多个不相关的规则
2. **condition 要具体** — 明确触发情况，避免"编写代码时"这种泛泛描述
3. **content 要可操作** — 告诉读者具体怎么做，而不只是"应该注意"
4. **代码片段必须 Good/Bad 对比** — 让人一目了然
5. **checklist 项必须可判定** — 能够回答 yes 或 no
