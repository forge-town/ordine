---
name: ordine-create-project
description: Use when 需要在 Ordine 系统中创建 GitHub 项目，将代码仓库关联到 Ordine 以便运行质量检查 Pipeline。触发词：创建项目、关联仓库、create project、新建项目、github项目。
---

# 创建项目

## 概述

Project（项目）是 Ordine 中代码仓库的映射。将 GitHub 仓库注册为项目后，可以对其运行 Pipeline 并关联 Job 记录。

## 数据结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识（如 `proj_my_app`） |
| `name` | `string` | 项目名称 |
| `description` | `string` | 项目描述 |
| `owner` | `string` | GitHub Owner（用户名或组织名） |
| `repo` | `string` | GitHub 仓库名 |
| `branch` | `string` | 默认分支（默认 `main`） |
| `githubUrl` | `string` | GitHub 仓库 URL |
| `isPrivate` | `boolean` | 是否为私有仓库 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## 典型工作流

### 1. 注册新项目

在 Ordine Web UI 的项目页面创建新项目，填写以下信息：

- **名称**：项目显示名称
- **Owner / Repo**：GitHub 仓库的 owner 和 repo 名
- **分支**：默认检查的分支
- **描述**：项目用途说明

### 2. 关联 Pipeline

项目创建后，运行 Pipeline 时通过 `projectId` 参数将 Job 关联到项目：

```bash
curl -X POST http://localhost:9433/api/pipelines/<PIPELINE_ID>/run \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/path/to/local/repo",
    "projectId": "proj_my_app"
  }'
```

### 3. 查看项目的 Job 历史

通过 `projectId` 过滤查看该项目的所有运行记录：

```bash
# 查看项目的所有 Job
curl -s "http://localhost:9433/api/jobs?projectId=proj_my_app" | python3 -m json.tool

# 只看失败的 Job
curl -s "http://localhost:9433/api/jobs?projectId=proj_my_app&status=failed" | python3 -m json.tool
```

### 4. 项目工作区

在 Web UI 中，项目详情页提供工作区视图，可以：
- 浏览项目文件结构
- 查看项目关联的 Job 运行历史
- 直接触发 Pipeline 运行

## 与其他实体的关系

```
Project (GitHub 仓库)
  ├── 关联 Job（通过 projectId）
  └── 提供输入路径（本地克隆路径）
         ↓
  Pipeline → Operation → Skill/Script
```

项目本身不直接包含 Pipeline 或 Operation，而是作为运行时的上下文（谁的代码被检查）。
