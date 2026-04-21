# 流水线引擎

流水线引擎（`packages/pipeline-engine`）是 Ordine 的核心调度组件，负责执行 DAG 工作流。

## 设计

引擎将流水线表示为有向无环图（DAG），其中：

- **节点** 表示执行单元（文件夹输入、操作、输出等）
- **边** 表示数据流方向
- **层级** 由拓扑排序确定执行顺序

## 执行流程

```
解析流水线定义
    │
    ▼
拓扑排序 → 确定执行层级
    │
    ▼
逐层执行（同层并行）
    │
    ├── 节点接收上游 NodeCtx
    ├── 节点执行逻辑
    └── 节点产生下游 NodeCtx
    │
    ▼
收集结果
```

## 核心类型

### NodeContext

```typescript
interface NodeContext {
  logger: Logger;
  runAgent: (options: AgentRunOptions) => Promise<Result<AgentRunResult, Error>>;
  readFile: (path: string) => Promise<string>;
  // ... 其他依赖注入
}
```

### NodeCtx

```typescript
interface NodeCtx {
  content: string;    // 节点输出内容
  inputPath: string;  // 输入路径
}
```

## 依赖注入

节点不直接依赖外部服务，而是通过 `NodeContext` 接收所有外部依赖。这使得：

- 节点可独立测试
- 依赖可在运行时替换
- Mock 注入简单直接

## 拓扑排序

引擎使用 Kahn 算法进行拓扑排序：

1. 计算每个节点的入度
2. 将入度为 0 的节点加入队列
3. 逐层处理，同层节点并行执行
4. 检测循环依赖

## 错误处理

遵循项目的 neverthrow 约定，所有操作返回 `Result` 类型。节点执行失败不会导致整个流水线崩溃，而是记录错误并继续执行独立的分支。
