---
name: ordine-create-pipeline
description: Use when 需要在 Ordine 系统中创建新的 Pipeline（质量检查流水线），包括定义节点（folder/operation/output）和边（连接关系），通过 REST API 或 UI 完成。触发词：创建流水线、新建pipeline、设计工作流、构建检查流程。
---

# 创建 Pipeline

## 概述

Pipeline 是 Ordine 的核心概念——一个有向无环图 (DAG)，将输入源（文件夹/项目）、Operation（检查/修复动作）和输出（报告路径）串联成自动化质量检查流程。

## 工作流程

1. 阅读 [pipeline-anatomy.md](references/pipeline-anatomy.md) 了解 Pipeline 的组成结构
2. 阅读 [node-types.md](references/node-types.md) 了解所有节点类型和配置
3. 按照 [creation-guide.md](references/creation-guide.md) 创建 Pipeline
4. 使用 [checklist.md](references/checklist.md) 验证
