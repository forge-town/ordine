# 流水线

流水线将操作组合成多步骤 DAG 工作流。流水线引擎负责调度、数据传递和错误处理。

## 节点类型

### folder

读取目录树作为输入：

```json
{
  "type": "folder",
  "data": { "path": "./src" }
}
```

### code-file

单文件输入：

```json
{
  "type": "code-file",
  "data": { "path": "./src/index.ts" }
}
```

### operation

执行一个操作：

```json
{
  "type": "operation",
  "data": { "operationId": "op_abc123" }
}
```

### output-local-path

将结果写入本地路径：

```json
{
  "type": "output-local-path",
  "data": { "path": "./.ordine/results" }
}
```

## 边

边定义节点间的数据流：

```json
{
  "source": "node-1",
  "target": "node-2"
}
```

## 执行模型

```
层级 0: [folder]  [code-file]   (并行)
           │          │
层级 1:    └───► [operation] ◄──┘  (等待所有上游完成)
                     │
层级 2:        [output-local-path]
```

1. 拓扑排序确定层级
2. 同层级节点并行执行
3. 数据沿边传递 `NodeCtx`（content + inputPath）
4. 所有上游完成后下游才开始

## 创建流水线

### 通过画布

1. 打开 Web 应用，导航到 **流水线**
2. 点击 **创建**
3. 在画布上拖拽添加节点
4. 连接节点定义数据流
5. 配置每个节点的属性

### 通过 API

```sh
curl -X POST http://localhost:9433/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码审查流水线",
    "nodes": [...],
    "edges": [...]
  }'
```

## 运行流水线

```sh
curl -X POST http://localhost:9433/api/pipelines/:id/run
```

执行创建一个任务（Job）来跟踪进度。
