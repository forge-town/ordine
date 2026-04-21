# 技能

技能是可插拔的 AI agent 能力，可被操作引用来驱动执行。

## 结构

```json
{
  "name": "代码审查",
  "description": "审查代码质量并提供改进建议",
  "category": "review"
}
```

## 工作原理

1. 操作引用一个技能
2. Agent 引擎加载技能描述和配置
3. AI agent（Claude/Codex）基于技能上下文执行
4. 结果作为结构化输出返回

## 创建技能

```sh
curl -X POST http://localhost:9433/api/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "安全审计",
    "description": "检查代码中的安全漏洞",
    "category": "security"
  }'
```

## 技能分类

| 分类 | 说明 |
|------|------|
| `review` | 代码审查和质量检查 |
| `security` | 安全扫描和漏洞检测 |
| `documentation` | 文档生成和检查 |
| `refactor` | 代码重构建议 |

## 内置技能

Ordine 自带一组内置技能，位于 `skills/` 目录下。这些技能涵盖常见的编码任务，可直接在操作中使用。

## 在操作中使用

在操作配置中通过 `skillId` 引用：

```json
{
  "executorType": "agent",
  "agentMode": "skill",
  "skillId": "skill_abc123"
}
```
