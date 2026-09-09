---
name: ordine-quickstart
description: 介绍 Ordine 核心概念与首次使用入口；适用于明确的入门请求。
---

# Ordine 入门

Ordine 将 Operation 通过 DAG 组合为 Pipeline。Operation 配置执行器和输入输出；执行 Pipeline 生成 Job，用 traces 和实际产物核实结果。Project 提供运行上下文，Distillation 与 Refinement 用于提炼结果和迭代。

## 开始使用

确认要连接的实例；独立 API 默认地址为 `http://localhost:9433`，CLI 使用 `ORDINE_API_URL`。仅当任务包含本地启动时，按仓库 README 配置并启动服务，保留已有环境文件和鉴权。

安装的 CLI 使用 `ordine`，源码仓库中可用 `bun apps/cli/src/index.ts`：

```bash
ordine --json pipelines list
ordine --json pipelines get <pipeline-id>
ordine --json jobs get <job-id>
```

用户要求执行时使用 `ordine --json run <pipeline-id>`；`--no-follow` 只提交并返回 Job ID。示例 ID 需要换成实际资源。`done` 表示执行状态，产物仍需核验。

## 按任务继续

- 创建图：`ordine-create-pipeline`；配置单个操作：`ordine-create-operation`。
- 运行：`ordine-run-pipeline` 或 `ordine-run-operation`。
- 查询运行记录：`ordine-manage-job`；诊断异常：`ordine-browse-traces`。
- 查询或复用资源：`ordine-list-entities`。

这些是可选入口，不需要依次调用全部技能。CLI 命令以 `--help` 为准；API 以目标版本的路由为准，不能由 CLI 中存在命令推断服务端已经实现。当前源码独立 Server 未挂载 Best Practice、Rule、Checklist Item、Code Snippet 接口。
