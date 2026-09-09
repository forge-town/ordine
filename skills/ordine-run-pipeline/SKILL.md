---
name: ordine-run-pipeline
description: 执行 Ordine Pipeline，并跟踪其 Job 与产物。
---

# 运行 Pipeline

## 概述

Pipeline 通过 REST API 触发运行，返回一个 Job ID。通过轮询 Job 状态可以跟踪执行进度。

## 执行与验收

核实目标 ID、输入及执行授权；用户已要求运行或验证时直接推进。命令和参数不明确时查阅 [run-guide.md](references/run-guide.md) 的相关部分。

记录返回的 Job ID，跟踪执行状态并核实本次要求的产物、内容和来源；状态成功不等于交付完成。遇到失败或暂停，检查相关错误，不盲目重跑或重复创建 Job。

- 失败或结果异常时查阅 [troubleshooting.md](references/troubleshooting.md)。
