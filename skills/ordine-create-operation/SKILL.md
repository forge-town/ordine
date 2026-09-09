---
name: ordine-create-operation
description: 在 Ordine 中创建 Operation，配置执行器和输入输出。
---

# 创建 Operation

## 概述

Operation 是 Ordine 中的原子操作单元，定义了「谁来执行」（executor）、「输入什么」（inputs）和「输出什么」（outputs）。Operation 可以被 Pipeline 中的 operation 节点引用。

## 按需参考

- 创建或修改时查阅 [creation-guide.md](references/creation-guide.md) 的相关操作。
- 数据结构不明确时查阅 [operation-anatomy.md](references/operation-anatomy.md)。
- [checklist.md](references/checklist.md) 提供 Operation 配置核对项，仅验证本次涉及的约束，不自动触发试运行。
