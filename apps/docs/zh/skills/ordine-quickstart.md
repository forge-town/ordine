# ordine-quickstart

Use when 需要了解 Ordine 系统的整体架构和快速上手指南，包括核心概念、实体关系、CLI 和 API 使用方法。触发词：ordine入门、快速开始、ordine是什么、系统架构、ordine overview。

## Skill 内容

复制以下内容并提供给你的 AI agent：

```markdown
---
name: ordine-quickstart
description: Use when 需要了解 Ordine 系统的整体架构和快速上手指南，包括核心概念、实体关系、CLI 和 API 使用方法。触发词：ordine入门、快速开始、ordine是什么、系统架构、ordine overview。
---

# Ordine 快速上手

## 是什么

Ordine 是一个 AI Agent first 的工作调度框架，用于自动化代码质量检查和修复。

## 核心概念

```
Skill (AI 能力)
  ↑ 被引用
Operation (原子操作: 检查/修复)
  ↑ 被组合        ↑ 被绑定
Pipeline (DAG 流水线)    Recipe (操作 + 规范绑定)
  ↓ 触发运行              ↑ 引用
Job (运行记录)    Best Practice (编码规范)
                            ├── Checklist Items
                            └── Code Snippets
```

### 实体关系

| 实体 | 说明 | 示例 ID |
|---|---|---|
| **Skill** | AI Agent 的能力 | `skill_check_dao` |
| **Operation** | 原子操作（引用 Skill） | `op_check_dao` |
| **Pipeline** | DAG 流水线（组合多个 Operation 节点） | `pipe_multi_quality_check` |
| **Best Practice** | 编码规范 | `bp_classname_convention` |
| **Recipe** | 绑定 Operation + Best Practice | `rcp_check_classname` |
| **Rule** | 自定义检查规则（含脚本） | `rule_no_template_classname` |
| **Job** | Pipeline 的一次运行记录 | `job_abc123` |
| **Checklist Item** | Best Practice 的检查项 | `cli_cn_1` |
| **Code Snippet** | Best Practice 的代码示例 | `cs_cn_good` |

## 环境准备

### 启动 Server

```bash
cd apps/server
cp .env.example .env  # 配置 DATABASE_URL
bun dev
```

默认端口 9433。

### 配置 CLI

```bash
export ORDINE_API_URL=http://localhost:9433
```

## CLI 命令速查

| 命令 | 说明 |
|---|---|
| `ordine pipelines` | 列出所有 Pipeline |
| `ordine ls` | 同上（别名） |
| `ordine run <id>` | 运行 Pipeline（自动 follow） |
| `ordine run <id> -i <path>` | 运行 Pipeline 并指定输入路径 |
| `ordine run <id> --no-follow` | 运行 Pipeline（不等待完成） |

## REST API 速查

基础 URL: `http://localhost:9433`

| 资源 | 端点 | 方法 |
|---|---|---|
| Pipelines | `/api/pipelines` | GET, POST, PUT |
| Pipelines | `/api/pipelines/:id` | GET, PATCH, DELETE |
| Pipelines | `/api/pipelines/:id/run` | POST |
| Operations | `/api/operations` | GET, POST, PUT |
| Operations | `/api/operations/:id` | GET, PATCH, DELETE |
| Best Practices | `/api/best-practices` | GET, POST, PUT |
| Best Practices | `/api/best-practices/:id` | GET, PATCH, DELETE |
| Best Practices | `/api/best-practices/export` | GET |
| Best Practices | `/api/best-practices/import` | POST |
| Recipes | `/api/recipes` | GET, POST, PUT |
| Rules | `/api/rules` | GET, POST, PUT |
| Rules | `/api/rules/:id` | GET, PATCH, DELETE |
| Skills | `/api/skills` | GET, POST |
| Skills | `/api/skills/:id` | GET, PATCH, DELETE |
| Jobs | `/api/jobs` | GET, POST |
| Jobs | `/api/jobs/:id` | GET, PATCH, DELETE |
| Checklist Items | `/api/checklist-items` | GET(?bestPracticeId), PUT, DELETE(?id) |
| Code Snippets | `/api/code-snippets` | GET(?bestPracticeId), PUT, DELETE(?id) |
| Filesystem | `/api/filesystem/browse` | GET(?path) |
| Filesystem | `/api/filesystem/tree` | GET(?path) |
| Health | `/health` | GET |

## 典型工作流

### 1. 创建一个代码质量检查流水线

```bash
# 1. 注册 Skill
# → 参见 ordine-create-skill

# 2. 创建 Operation（引用 Skill）
# → 参见 ordine-create-operation

# 3. 创建 Best Practice + Checklist
# → 参见 ordine-create-bestpractice

# 4. 创建 Recipe（绑定 Operation + Best Practice）
# → 参见 ordine-create-recipe

# 5. 创建 Pipeline（组合 Operation 节点）
# → 参见 ordine-create-pipeline

# 6. 运行 Pipeline
ordine run pipe_check_xxx -i ./src
# → 参见 ordine-run-pipeline
```

### 2. 日常使用

```bash
# 查看有哪些 Pipeline
ordine ls

# 运行检查
ordine run pipe_multi_quality_check -i ./src

# 查看运行结果
curl -s "http://localhost:9433/api/jobs?status=completed" | python3 -m json.tool
```

## 相关 Skill

| Skill | 用途 |
|---|---|
| `ordine-quickstart` | 本文 — 系统概览和快速上手 |
| `ordine-create-pipeline` | 创建 Pipeline |
| `ordine-list-pipelines` | 列出 Pipeline |
| `ordine-run-pipeline` | 运行 Pipeline + 监控 Job |
| `ordine-create-operation` | 创建 Operation |
| `ordine-create-bestpractice` | 创建 Best Practice |
| `ordine-create-recipe` | 创建 Recipe |
| `ordine-create-rule` | 创建 Rule |
| `ordine-create-skill` | 注册 Skill |
| `ordine-manage-job` | 管理 Job |
| `ordine-manage-checklist` | 管理 Checklist Items |
| `ordine-manage-codesnippet` | 管理 Code Snippets |
| `ordine-browse-filesystem` | 浏览文件系统 |
| `ordine-export-import` | 导出/导入 Best Practice |

```
