---
name: ordine-run-pipeline
description: Use when 需要在 Ordine 系统中运行 Pipeline、监控 Job 执行状态或排查运行失败。触发词：运行pipeline、执行流水线、查看job状态、pipeline调试。
---

# 运行 Pipeline

## 概述

Pipeline 通过 REST API 触发运行，返回一个 Job ID。通过轮询 Job 状态可以跟踪执行进度。

## 工作流程

1. 阅读 [run-guide.md](references/run-guide.md) 了解运行和监控流程
2. 使用 [troubleshooting.md](references/troubleshooting.md) 排查失败原因
