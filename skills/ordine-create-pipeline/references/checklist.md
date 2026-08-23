# Pipeline 创建检查清单

- [ ] Pipeline ID 以 `pipe_` 开头
- [ ] 有描述性的 name 和 description
- [ ] tags 描述实际业务目标；除非用户要质量检查，否则不要默认使用 check/fix/quality
- [ ] 至少有一个输入节点（folder/file/github-project/prompt）
- [ ] 至少有一个 operation 节点
- [ ] operation 节点的 `operationId` 引用已存在的 Operation，或引用当前提案中明确创建的新 Operation
- [ ] 有 output-local-path 或 output-project-path 节点接收结果
- [ ] 所有节点通过 edges 正确连接
- [ ] 边反映真实依赖；互不依赖的 Operation 没有被机械串联
- [ ] 每个整理、校验、修订或导出 Operation 的提示明确要求返回完整成品，而不是摘要或“沿用上一步”
- [ ] 连接到最终输出节点的直接上游内容可独立交付，不依赖更早但已被省略的节点正文
- [ ] 没有用多个 Agent 串行重写同一大成品；可在单个节点内完成的质量迭代使用 `loopEnabled`
- [ ] DAG 无环（无循环依赖）
- [ ] 节点 ID 以 `n_` 开头，边 ID 以 `e_` 开头
- [ ] 通过 API 或 UI 验证 Pipeline 可成功读取
