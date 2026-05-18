# ordine-run-operation

Use when 需要在 Ordine 中运行单个 Operation、确认数据库中的 operation 配置、传入文件夹或文本输入并监控生成的 Job 状态。触发词：运行operation、执行操作、op_run、operation调试。

## Skill 内容

复制以下内容并提供给你的 AI agent：

```markdown
---
name: ordine-run-operation
description: Use when 需要在 Ordine 中运行单个 Operation、确认数据库中的 operation 配置、传入文件夹或文本输入并监控生成的 Job 状态。触发词：运行operation、执行操作、op_run、operation调试。
---

# 运行 Operation

## 概述

Operation 通过 REST API 触发运行，返回 Job ID；Job 状态和 traces 用于跟踪执行过程。

## 工作流程

1. 运行前读取 [run-guide.md](references/run-guide.md)，确认 Operation、输入、命令和预期输出
2. 执行后读取 [checklist.md](references/checklist.md)，逐项确认运行结果
```
