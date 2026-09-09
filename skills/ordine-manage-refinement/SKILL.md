---
name: ordine-manage-refinement
description: 管理 Ordine Refinement，基于 Distillation 迭代 Pipeline。
---

# 管理 Refinement

## 概述

Refinement 以 Distillation 为输入，按轮次优化 Pipeline、运行 Pipeline、再蒸馏运行结果。

## 按需参考

- 操作和参数见 [workflow.md](references/workflow.md)，只读取当前任务对应部分。
- 核对改动或运行结果时使用 [checklist.md](references/checklist.md) 的相关项；单纯查询不触发运行。
- 运行沿用用户授权的目标与范围；Refinement 的轮数和停止条件应在运行前确定，不能无限扩展优化。
