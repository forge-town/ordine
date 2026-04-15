# Pipeline 创建检查清单

- [ ] Pipeline ID 以 `pipe_` 开头
- [ ] 有描述性的 name 和 description
- [ ] tags 包含相关关键词（check/fix/quality 等）
- [ ] 至少有一个输入节点（folder/code-file/github-project）
- [ ] 至少有一个 operation 节点
- [ ] operation 节点的 `operationId` 引用已存在的 Operation
- [ ] 有 output 节点接收结果
- [ ] 所有节点通过 edges 正确连接
- [ ] DAG 无环（无循环依赖）
- [ ] 节点 ID 以 `n_` 开头，边 ID 以 `e_` 开头
- [ ] 通过 API 或 UI 验证 Pipeline 可成功读取
