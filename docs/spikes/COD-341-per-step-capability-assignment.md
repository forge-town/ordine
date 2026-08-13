# COD-341：按 Step 分配执行器与能力

## 结论

COD-341 可以在现有 Pipeline Agent 流程内以 fail-closed 方式完成。生产实现把“为新 Operation 选择执行器”拆成独立的结构化输出阶段，并在生成图之前完成全批次校验：

- 只接受本轮 `new/unmatched` Operation，且每个 Operation 必须恰好有一条 assignment；
- `script`、prompt agent、skill agent 使用严格且互斥的 executor 结构；
- Agent 的扁平 `agent + model` 必须来自 COD-337 的本地 runtime model catalog；
- `skillId`、`allowedTools` 只接受 COD-340 能力目录的 `reference`，并校验 kind、runtime 支持和风险；
- 首次无效时只允许一次完整 repair；repair 仍无效时返回空 assignment，不保存部分结果；
- edit 流程通过 `updateOperation` 原地修改当前画布引用的共享 Operation，不复制 Operation。

最终集成基线为 `upstream/develop@665a4dc8`，直接消费 COD-340 squash merge 后的生产契约。MCP reference 由 `buildMcpServerKey(connectorId)` 和 `buildMcpToolReference(serverKey, toolName)` 生成，未使用旧的显示名派生格式。

## 生产流程

### 新增或未匹配 Step

1. `generateStructure` 仅为 `unmatchedSteps` 创建临时 Operation id。
2. 编排器从会话选择的 `runtimeId + model` 中取有效组合；选择失效时依次回退到设置中的有效默认、runtime catalog 默认和首个可用模型。
3. assignment agent 为每个 id 选择 script、prompt agent 或 skill agent，并给出单行 `assignmentReason`。
4. `parseCapabilityAssignments` 对整个批次做结构、数量、目录、runtime 和风险校验。
5. 第一次失败时发送完整上下文、原输出和诊断做一次 repair；第二次失败返回 `assignments: []`。
6. 成功结果再经过 COD-340 `validateOperationConfigs` 校验，随后才进入 `pendingOperations`。已匹配 Operation 不参与分配，也不被改写。

Operation 只持久化扁平 `agent` 和 `model`，不会持久化 runtime config id。图节点也不会被统一写入编排器 runtime。

### 编辑已有 Operation

`PipelineActionSchema` 新增严格的 `updateOperation` action。提案生成时必须同时满足：

- `operationId` 是当前画布实际引用的已有 Operation；
- executor 的 agent/model/capability 全部在目录内；
- 不可逆能力在 `assignmentReason` 中明确说明必要性；
- schema 或语义失败只 repair 一次。

审批时再次按 session snapshot 校验 Operation 范围，保留原 inputs/outputs，仅替换 executor，并复用 COD-340 的目录校验。Operation 更新、pending Operation 创建、proposal 状态和 session 状态处于同一审批事务。

### 执行优先级

运行时按以下优先级决定 agent/model：

1. 节点关联的 Agent entity 默认 runtime/model；
2. 节点显式 `agentRuntime`（为避免跨 runtime 误用，此时不沿用 executor model）；
3. Operation executor 的扁平 `agent + model`；
4. runner 既有默认值。

因此 COD-341 保存的 per-operation model 会在没有更高优先级覆盖时真实传入 prompt/skill runner。
MCP credential source 同样按当前 Operation 的实际 agent 选择；当节点覆盖为另一种 agent 时，不会继承默认 runtime 的 SSH 连接或默认模型。Operation 详情页和画布属性编辑器在保存其他字段时会保留已有的 `agent/model/allowedTools/assignmentReason`。

## 代表性 Fixture 与解析率

这些结果来自确定性 JSON fixture，不调用真实 LLM。

| 类型   | Fixture                                                          | 预期       | 结果 |
| ------ | ---------------------------------------------------------------- | ---------- | ---- |
| 有效 1 | 同一批次包含 deterministic bash script 和需要判断的 prompt agent | 接受       | 通过 |
| 有效 2 | skill agent 使用目录 `reference` 作为 `skillId`                  | 接受       | 通过 |
| 有效 3 | 使用稳定 MCP reference，并明确说明不可逆发送的必要性             | 接受       | 通过 |
| 无效 1 | 缺失、重复、额外 Operation，同时包含目录外 model/tool            | 整批拒绝   | 通过 |
| 无效 2 | 使用不可逆能力但理由未明确说明不可逆性                           | 整批拒绝   | 通过 |
| 无效 3 | 首次失败且唯一一次 repair 仍无效                                 | 空结果中止 | 通过 |

- 有效 fixture 接受率：`3/3 = 100%`；
- 无效 fixture 预期拒绝率：`3/3 = 100%`；
- 预期行为符合率：`6/6 = 100%`。

这不是模型生成成功率。未自动调用真实模型，避免使用开发者凭据或产生外部调用成本；真实模型的一次成功率与 repair 成功率仍需在受控环境另行采样。

## 关键测试覆盖

- `capabilityAssignment.unit.test.ts`：script/agent/skill、稳定 MCP reference、目录外引用、不可逆理由、原子失败和一次 repair；
- `resolveAssignmentRuntime.unit.test.ts`：runtime config 去重、会话选择、有效默认回退和无模型目录失败；
- `generateStructure.unit.test.ts`：mixed executor、pending-only、二次目录校验、已匹配 Operation 不变；
- `proposeActions.unit.test.ts`：`updateOperation` 成功、目录外值 repair 后拒绝、画布外 Operation 拒绝；
- `createPipelineAgentSessionsService.unit.test.ts`：审批事务内更新共享 Operation及越权目标拒绝；
- `OperationNode.test.ts`：executor model 生效及 Agent/node override 优先级；
- schema、graph action、REST 输入和 proposal view 均有对应测试。

最终基线上的合并验收结果：agent-engine `16/16`、schemas `2/2`、pipeline-engine `44/44`、services `115/115`、views `3/3`、server routes `9/9`，共 `189/189`。agent-engine、schemas、pipeline-engine、services、views、app、server 类型检查均通过；相关 lint exit 0（仅保留仓库既有 warning）。

## 已知边界

- COD-337 当前只在 local connection 上提供模型目录；没有模型目录的 SSH runtime 不会成为 assignment 编排器或 per-step agent/model 候选。
- “最小权限”通过目录 membership、runtime 支持、最多 8 个工具、重复引用拒绝和 prompt 约束落实；是否存在更小但同样可完成任务的能力集合仍属于模型语义质量问题。
- 真实 LLM 质量、延迟和成本不在本地 fixture 的结论范围内。
