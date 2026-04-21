# ordine-create-rule

Use when 需要在 Ordine 系统中创建 Rule（自定义检查规则），定义检查脚本、严重级别和适用对象类型。触发词：创建规则、新建rule、添加检查规则、自定义lint规则。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-create-rule
description: Use when 需要在 Ordine 系统中创建 Rule（自定义检查规则），定义检查脚本、严重级别和适用对象类型。触发词：创建规则、新建rule、添加检查规则、自定义lint规则。
---

# 创建 Rule

## 概述

Rule 是 Ordine 中的自定义检查规则，包含可执行的检查脚本（checkScript），能够对代码进行自动化验证。

## 快速参考

### CLI

> CLI 当前不直接支持 Rule CRUD。使用 REST API 操作。

### REST API

```bash
# 列出所有规则
curl -s http://localhost:9433/api/rules | python3 -m json.tool

# 按分类过滤
curl -s "http://localhost:9433/api/rules?category=naming" | python3 -m json.tool

# 按启用状态过滤
curl -s "http://localhost:9433/api/rules?enabled=true" | python3 -m json.tool

# 查看单个
curl -s http://localhost:9433/api/rules/rule_xxx | python3 -m json.tool

# 创建
curl -X POST http://localhost:9433/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rule_no_template_classname",
    "name": "禁止模板字符串 className",
    "description": "检查是否存在 className 使用模板字符串而非 cn() 的情况",
    "category": "style",
    "severity": "warning",
    "checkScript": "grep -rn \"className={\`\" --include=\"*.tsx\" --include=\"*.jsx\" $TARGET_PATH",
    "scriptLanguage": "bash",
    "acceptedObjectTypes": ["folder", "code-file"],
    "enabled": true,
    "tags": ["classname", "style", "react"]
  }'

# 更新（PUT = upsert）
curl -X PUT http://localhost:9433/api/rules \
  -H "Content-Type: application/json" \
  -d '{ "id": "rule_no_template_classname", "severity": "error" }'

# 部分更新
curl -X PATCH http://localhost:9433/api/rules/rule_no_template_classname \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'

# 删除
curl -X DELETE http://localhost:9433/api/rules/rule_no_template_classname
```

## 数据结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，格式：`rule_<描述>` |
| `name` | `string` | 规则名称 |
| `description` | `string \| null` | 规则描述 |
| `category` | `RuleCategory` | 分类：`naming`, `structure`, `testing`, `style`, `performance`, `security` |
| `severity` | `string \| null` | 严重级别：`error`, `warning`, `info` |
| `checkScript` | `string \| null` | 检查脚本内容 |
| `scriptLanguage` | `string \| null` | 脚本语言：`bash`, `javascript`, `python` |
| `acceptedObjectTypes` | `string[] \| null` | 接受的对象类型 |
| `enabled` | `boolean` | 是否启用 |
| `tags` | `string[] \| null` | 标签 |

## 命名规范

- ID: `rule_<动作或描述>` — 如 `rule_no_template_classname`, `rule_one_component_per_file`
- 以 `rule_no_` 开头表示禁止型规则
- 以 `rule_require_` 开头表示强制型规则

## checkScript 编写

checkScript 中可使用 `$TARGET_PATH` 变量代表目标路径：

```bash
# bash 示例 — 检查是否有 console.log
grep -rn "console\.log" --include="*.ts" --include="*.tsx" $TARGET_PATH

# bash 示例 — 检查文件命名
find $TARGET_PATH -name "*.tsx" | while read f; do
  basename=$(basename "$f" .tsx)
  if [[ ! "$basename" =~ ^[A-Z] ]]; then
    echo "FAIL: $f — 组件文件名必须大写开头"
  fi
done
```

脚本返回 exit code 0 表示通过，非零表示失败。

```
