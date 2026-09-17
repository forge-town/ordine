---
name: ordine-create-bestpractice
description: 在 Ordine 中创建 Best Practice 编码规范及关联示例、检查项。
---

# 创建 Best Practice

当前源码独立 Server 未挂载 Best Practice、Rule、Checklist Item、Code Snippet 接口；涉及这些资源时，先确认目标版本支持。历史示例不证明接口可用，404 后不要重复试探。

## 概述

Best Practice 是 Ordine 中的编码规范单元，描述了「什么情况下」（condition）应该「怎么做」（content），并附带代码片段（codeSnippets）和检查清单条目（checklistItems）。

## 按需参考

- 创建或修改时查阅 [creation-guide.md](references/creation-guide.md) 的相关操作。
- 数据结构不明确时查阅 [bestpractice-anatomy.md](references/bestpractice-anatomy.md)。
- [checklist.md](references/checklist.md) 提供 Best Practice 配置核对项，仅验证本次涉及的约束，不自动触发试运行。
