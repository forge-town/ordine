---
name: ordine-create-pipeline
description: Use when 需要在 Ordine 系统中创建或编辑自动化 Pipeline，包括定义输入、Operation、输出和它们之间的 DAG 依赖关系，通过 Agent、REST API 或 UI 完成。触发词：创建流水线、新建pipeline、设计工作流、编辑画布、构建自动化流程。
---

# 创建 Pipeline

## 概述

Pipeline 是 Ordine 的核心概念——一个有向无环图 (DAG)，将输入源、Operation 和输出连接成自动化流程。Pipeline 可以是串行、并行或分支汇合结构；不要把所有 Operation 默认串成一条直线。

## 工作流程

1. 阅读 [pipeline-anatomy.md](references/pipeline-anatomy.md) 了解 Pipeline 的组成结构
2. 阅读 [node-types.md](references/node-types.md) 了解所有节点类型和配置
3. 按照 [creation-guide.md](references/creation-guide.md) 创建 Pipeline
4. 使用 [checklist.md](references/checklist.md) 验证

## 拓扑选择原则

- 根据真实数据依赖连边，不要根据 Operation 在描述中的出现顺序机械连边
- 后一步必须消费前一步结果时使用串行
- 多个步骤只依赖同一个上游、彼此不依赖时使用并行分支
- 汇总步骤需要多个分支的结果时，让这些分支共同连接到汇总节点
- 不需要汇总时，每个并行分支可以连接到各自输出
- 节点按依赖层级从左到右排列；同层并行节点使用相同 x，并在 y 方向错开

## 数据保真原则

- 每个 Operation 只接收其直接父节点的输出；它看不到更早节点中已经被省略的正文
- 整理、修订、校验、纠错、排版或导出成品的 Operation，必须输出完整成品正文，不能只输出摘要、目录、修改清单或“沿用上一步”的引用
- 已存在于输入中的有效内容不能替换成“待补充”“略”或要求用户再次提供
- 质量复核优先使用同一 Operation 的 `loopEnabled` 自检迭代，避免多个 Agent 串行反复改写同一大成品并逐步丢失内容
- 最终输出节点只会写入它直接收到的内容，因此连接到输出节点的上游结果必须是可独立交付的完整成品
