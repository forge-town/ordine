# ordine-create-skill

Use when 需要在 Ordine 系统中注册 Skill（技能），技能是 Operation 的执行器，代表 AI Agent 的具体能力。触发词：创建技能、新建skill、注册能力、添加agent skill。

## Skill Content

Copy the content below and provide it to your AI agent:

```markdown
---
name: ordine-create-skill
description: Use when 需要在 Ordine 系统中注册 Skill（技能），技能是 Operation 的执行器，代表 AI Agent 的具体能力。触发词：创建技能、新建skill、注册能力、添加agent skill。
---

# 创建 Skill

## 概述

Skill 是 Ordine 中 AI Agent 的能力单元。Operation 通过 executor 引用 Skill 来执行检查或修复操作。首次 GET 列表时会自动 seed 默认数据。

## 快速参考

### CLI

> CLI 当前不直接支持 Skill CRUD。使用 REST API 操作。

### REST API

```bash
# 列出所有（首次调用会自动 seed）
curl -s http://localhost:9433/api/skills | python3 -m json.tool

# 查看单个
curl -s http://localhost:9433/api/skills/skill_check_dao | python3 -m json.tool

# 创建
curl -X POST http://localhost:9433/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "id": "skill_check_naming",
    "name": "命名规范检查",
    "description": "检查文件和变量命名是否符合项目规范"
  }'

# 部分更新
curl -X PATCH http://localhost:9433/api/skills/skill_check_naming \
  -H "Content-Type: application/json" \
  -d '{ "description": "升级版命名规范检查" }'

# 删除
curl -X DELETE http://localhost:9433/api/skills/skill_check_naming
```

## 数据结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，格式：`skill_<动词>_<名词>` |
| `name` | `string` | 技能名称 |
| `description` | `string \| null` | 技能描述 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## Skill 与 Operation 的关系

```
Skill (执行能力)          Operation (操作定义)
skill_check_dao     ←---  op_check_dao.config.executor.skillId
```

Skill 定义 Agent 的能力，Operation 引用 Skill 来完成具体操作。

## 命名规范

| 前缀 | 用途 | 示例 |
|---|---|---|
| `skill_check_` | 检查能力 | `skill_check_dao`, `skill_check_classname` |
| `skill_fix_` | 修复能力 | `skill_fix_classname`, `skill_fix_import` |
| `skill_gen_` | 生成能力 | `skill_gen_test`, `skill_gen_storybook` |
| `skill_analyze_` | 分析能力 | `skill_analyze_complexity` |

## 自动 Seed

首次访问 `GET /api/skills` 时，如果数据库中没有 Skill 数据，会自动调用 `skillsDao.seedIfEmpty()` 填充默认 Skill。

```
