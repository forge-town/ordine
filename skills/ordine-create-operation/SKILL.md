---
name: ordine-create-operation
description: Use when 需要在 Ordine 系统中创建新的 Operation（原子操作），定义执行器（skill/script）、输入输出和接受的对象类型。触发词：创建操作、新建operation、添加检查操作、添加修复操作。
---

# 创建 Operation

## 概述

Operation 是 Ordine 中的原子操作单元，定义了「谁来执行」（executor）、「输入什么」（inputs）和「输出什么」（outputs）。Operation 可以被 Pipeline 中的 operation 节点引用。

## 工作流程

1. 阅读 [operation-anatomy.md](references/operation-anatomy.md) 了解 Operation 结构
2. 按照 [creation-guide.md](references/creation-guide.md) 创建
3. 使用 [checklist.md](references/checklist.md) 验证
