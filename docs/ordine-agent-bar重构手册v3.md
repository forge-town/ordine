# Ordine Agent Bar 重构手册 v3（智能层接通）

> 2026-06-11 · 本文档**续接** `ordine重构施工手册v2.md`（N3–N10 已全部完成，commit `f6e1ad2f` … `adfaba99`），从 **N11** 起继续编号，成为 Agent Bar 智能层的**唯一施工计划**。
> 定位：v2 把 Agent Bar 的**壳**（七阶段 UI、极简风格、线程、ContextStrip、Select→Prompt 前端）做齐了；本手册解决的是壳下面**智能链路断裂**的问题——选中引用没传给 LLM、Agent 失忆、不能开口追问、Context Strip 假透明、逆向工程空壳、失败静默。Agent Bar 是产品核心（PRD §7.4 / 决策 5 / 决策 6 / 原则 5、6），这些不通则产品不成立。
> 执行规则与质量门沿用 v2 §0：neverthrow 零 try-catch、Zod 唯一真相、单文件单职责（~200 行红线）、一任务一 commit（`<type>: <中文描述> (N11-01)`）、`bun run format` + `bun run quality` 全绿。**新组件必须 useTranslation（en+zh 同步加键）+ story + data-testid。**

---

## 一、现状审查（代码证据，按严重度排序）

逐文件追完 `AgentBar/` 前端与 `proposeActions` 后端全链路后的结论：

### 1.1 Select → Prompt 在 API 边界断裂（P0 致命）

- Composer 把 `referencedNodeIds` 放进 metadata（`Composer/Composer.tsx:95-98`），`useAgentConversation.ts:151` 也把它放进了请求 payload；
- 但 tRPC 的 input schema（`apps/app/src/integrations/trpc/routers/pipelines.ts:121-130`）**没有声明该字段**，zod 解析时直接丢弃；`createPipelinesService.ts:612-618` 的 service 签名也不接收。
- **结果：用户选中节点/边后，LLM 完全不知道选了什么。** @ 芯片、spotlight、线程徽标整套 v2 成果只是 UI 装饰。

### 1.2 Agent 完全失忆（P0）

- `proposeActions` 的 prompt 只含：图快照 + 操作目录 + **当前这一条消息**（`createPipelinesService.ts:676-692`）。
- 对话历史已持久化在 `conversation_messages`（DAO 有现成 `getByPipelineId(pipelineId, limit)`），但服务端从不读取。
- "Revise" 按钮只是清空 proposal + 发一句写死文案（`useAgentConversation.ts:266-273`），下一轮 Agent 不知道上个提案是什么、为什么被拒。

### 1.3 Agent 不能说话、不能追问（P0）

- `PROPOSE_SYSTEM_PROMPT` 强制输出 `{summary, actions}` 且 "actions 至少一个"（`createPipelinesService.ts:303-309`），LLM 没有回复或提问的出口；
- 服务端返回值里 `reply` 只在 runtime 缺失时出现（:641-649）；正常路径的 assistant 文案全部是前端写死的英文字符串（`useAgentConversation.ts:163,173-174,233,241,261,269-272`），未走 i18n；
- `AgentBody.tsx` **没有 clarify 分支**（仅处理 empty/reversing/applied/running/done，:28-79）——PRD 7.4 的"快捷选项芯片追问"前后端都不存在。phase 会被 set 成 `clarify` 但界面无任何追问内容。

### 1.4 Context Strip 假透明（违反 PRD 原则 6，且是反向违反）

- `ContextStrip.tsx:36-95` 硬编码 8 项（Project info / snapshot / thread / selection / annotations / run state / node runtime / memory）并标注入规则；
- 实际后端只收到 snapshot + 当前消息。**展示的与注入的不一致，比不展示更糟。**

### 1.5 逆向工程是空壳（P1 获客钩子失效）

- 附件只取文件名：`Composer.tsx:71` `files.map((file) => ({ name: file.name }))`，`ConversationAttachmentSchema` 也只有 name/path/type；LLM 只能从文件名猜（:665-674 注入的 "SAMPLE ARTIFACTS" 就是这几个名字）；
- reversing 四步进度是假动画：`AgentBar.tsx:63-72` 的 done 标志只看 `isReversing`，与真实分析进度无关。

### 1.6 失败路径静默（违反原则 5）

- 服务端 6 个 early-return（invalid snapshot / runtime 缺失 / agent 失败 / JSON 提取失败 / JSON 解析失败 / schema 校验失败）全部返回 `{proposal: null, diagnostics: []}`（:624-765），无原因码；
- 前端 fallback 一句 "I could not find a safe graph change."——没有原因、没有可点击动作。
- 运行期 ErrorCard 的 what/why/try 是模板拼接 + `job.error` 原文（`runSummary.ts:120-131`），不是"翻译成人话"；自愈卡是前端解析 `@@SELF_HEAL::` 魔法字符串，Agent 没参与。

### 1.7 其他

- 单次阻塞调用 + 静默重试 3 次，无任何中间反馈（`runAgent` 已有 `onProgress` 钩子但未利用，`agentRunner.ts:14`）；
- 运行中提问不带 job/trace 上下文（Strip 声称 "run-time priority" 是假的）；
- `createPipelinesService.ts` 已 1236 行，远超 200 行红线，proposeActions 改造前必须先拆。

**v2 已做对、本轮不动的**：proposal 校验链（`validatePipelineActions` + operation 目录校验 + `normalizeProposalPayload` 别名归一化）质量好，全部保留；七阶段 UI、线程/resolve、RefChips 双向联动、持久化层不返工。

---

## 二、处置决策

1. **修链路不推倒**：`useAgentConversation` / persistence / agentBarStore / messages 极简元件全部保留，改的是数据流和服务端，不是 UI。
2. **proposeActions 拆目录先行**：`createPipelinesService.ts` 超红线 6 倍，先把 propose 相关抽到 `pipelinesService/proposeActions/`（buildProposePrompt / normalizeProposalPayload / 校验），纯函数化以便单测——这是 N11 全部任务的地基。
3. **上下文单一事实源在前端**：ContextStrip 与实际发送读同一个 `buildAgentContext()` 输出——Strip 显示什么就发什么；服务端只追加**只有服务端才有**的数据（operations 目录、job traces）。杜绝两边各编一套。
4. **响应 schema 升级而非新接口**：`proposeActions` 返回升级为 `{reply, clarifyOptions?, proposal?, error?}`，向后兼容（旧格式 normalize 合成 reply）；不开第二个对话端点。
5. **Memory summary 诚实化**：真正的跨会话记忆不在本轮范围。Strip 的 memory 项在实现前**不点亮**（对应假透明修正）；对话窗口 + 上轮提案摘要充当短期记忆。
6. **phase 推进不扩散**：现有 `setPhase` 调用点集中在 `useAgentConversation` + derivePhase（v2 决策），本轮新增的 clarify 推进仍只在该 hook 内，禁止新增其他业务调用点。
7. **流式分两步走**：先用 `onProgress` 做粗粒度阶段事件（轮询/订阅均可），token 级流式 reply 列为可选（N15-02），不阻塞主线。

---

## 三、目标架构（增量部分）

```
packages/schemas/src/
  pipeline/ProposeActionsResponseSchema.ts   ← {reply, clarifyOptions?, proposal?, error?}
  conversation/AgentContextPayloadSchema.ts  ← 与 ContextStrip 8 项一一对应的结构化上下文
  conversation/ConversationMessageMetadataSchema.ts ← attachments 增 size/excerpt；metadata 增 clarifyOptions/diagnostics
packages/services/src/pipelinesService/
  createPipelinesService.ts                  ← 瘦身：propose 逻辑全部迁出
  proposeActions/
    proposeActions.ts                        ← 主流程（≤200 行）
    buildProposePrompt.ts                    ← system+user prompt 组装（纯函数，含 SELECTION/HISTORY/CONTEXT/DIAGNOSTICS 段）
    normalizeProposalPayload.ts              ← 自现文件迁出，原样
    analyzeArtifacts.ts                      ← 逆向第一段：样本结构分析
apps/app/src/pages/WorkspacePage/AgentBar/
  context/buildAgentContext.ts               ← 上下文组装单一事实源（Strip 与发送共用）
  useAgentConversation.ts                    ← reply/clarify 渲染、错误码映射、reversing 真状态机
  Composer/ContextStrip.tsx                  ← 改为消费 buildAgentContext 输出
  Composer/Composer.tsx                      ← 附件读真实内容
  messages/ClarifyOptions.tsx                ← 追问芯片（复用 SuggestionList 样式）
```

行数预算：`proposeActions/` 单文件 ≤200；`buildAgentContext.ts` ≤150；前端改动文件不突破现有行数 +30%。

---

## 四、任务拆分（续 N 系列，按序执行）

### N11 · 主路径接通：Selection、记忆、开口说话（本轮核心）

- **N11-00 基线与拆分**：本手册复制入仓 `docs/ordine-agent-bar重构手册v3.md`；确认工作树干净；`createPipelinesService.ts` 的 propose 相关代码（PROPOSE_SYSTEM_PROMPT:279-322、normalizeProposalPayload:386-576、proposeActions:612-776）**原样迁移**到 `proposeActions/` 子目录（行为零变化，现有单测全绿作为证明）；`bun run quality` 基线追加 `docs/refactor-baseline.md`。验收：迁移前后 `createPipelinesService.unit.test.ts` 与 `useAgentConversation.unit.test.tsx` 全绿，无任何行为 diff。
- **N11-01 referencedNodeIds 贯通**：tRPC input 增 `referencedNodeIds: z.array(z.string()).optional()`（`routers/pipelines.ts:121-130`）→ service opts 增参 → `buildProposePrompt` 新增 `=== USER SELECTION ===` 段：按 ref id 从 snapshot 捞出节点/边完整 JSON（id 含钻入路径 `n4/vc` 形态时取 baseId 匹配，标注路径），并指示"用户的请求针对这些元素，优先对它们提出修改"。失效 id 跳过并在段内注明。验收：单测覆盖节点/边/钻入/失效 id 四种组装；手测选中节点说"把这个节点的 prompt 改成 X"→ 返回针对该节点的 `replaceNodeData`。
- **N11-02 对话历史注入**：service 内用 `conversationMessagesDao.getByPipelineId(pipelineId)` 取最近 20 条，窗口规则：单条截断 500 字符、总量 ≤8000 字符、最旧的先丢；带 `proposalSnapshot` 的消息标注 `[applied]`/`[rejected]`；组装成 `=== CONVERSATION HISTORY (oldest first) ===` 段。验收：窗口截断单测；手测两轮对话，第二轮"再加一个校验步骤"能正确基于第一轮产物（代词可解析）。
- **N11-03 响应 schema 升级（Agent 能回复与追问）**：新建 `ProposeActionsResponseSchema` `{reply: string, clarifyOptions?: string[](≤4), proposal?: PipelineActionProposal | null}`；重写 PROPOSE_SYSTEM_PROMPT 输出段——**必须**给 reply（用户的语言）；意图明确 → proposal + reply；意图歧义 → clarifyOptions 且不给 proposal；无法安全修改 → reply 说明原因。normalize 兼容旧格式（仅 `{summary, actions}` 时以 summary 合成 reply）。tRPC 输出与前端类型同步。验收：单测含三种输出形态解析 + 旧格式兼容；手测模糊请求（"帮我处理一下文件"）得到追问而非硬编的图。
- **N11-04 前端 clarify 渲染与 canned 文案清零**：`useAgentConversation` 改用 `result.reply` 作 assistant 消息内容，clarifyOptions 存进消息 metadata；新建 `messages/ClarifyOptions.tsx` 芯片组件（样式对照原型 workspace.jsx:103-116，复用 SuggestionList 视觉），点击即发送该选项文本；`AgentBody` 增 clarify 分支；phase 推进规则：有 clarifyOptions 无 proposal → clarify，有 proposal → proposal（仍在本 hook 内）。删除 :163,173-174,233,241,261,269-272 全部写死英文，失败兜底走 i18n 键（en+zh）。验收：芯片可点可发；七阶段逐一目检；grep 不到 canned 英文字符串。
- **N11-05 Revise / diagnostics 修复回路**：`reviseProposal` 把被拒 proposal 的 summary + 动作清单写成一条带 `metadata.proposalSnapshot` 的 assistant 消息（自然进入 N11-02 的历史窗口）；ProposalCard 在存在阻塞 diagnostics 时增加行内 "Ask agent to fix" 按钮 → `submitMessage` 携带 `metadata.diagnostics`（schema 扩展）→ `buildProposePrompt` 注入 `=== PREVIOUS PROPOSAL DIAGNOSTICS ===` 段。验收：人为构造 unknown operationId 提案 → 点 fix → 新提案通过校验链。
- **N11 整体验收**：选中节点改它 / 两轮指代 / 模糊追问 / 拒绝后修订四条路径全部真实跑通（真 LLM），录屏或截图存 pr-assets/。

### N12 · 上下文透明做实（ContextAssembler 单一事实源）✅ 2026-06-12 完成

> 执行记录：N12-01 `79b3c622` / N12-02 `0484efe6` / N12-03 `b7845ddb`。真机验收全过（Strip 真数据三态、selection 联动、运行中提问引用真实 trace），详见 `pr-assets/n16-验收记录.md` N12 段。与计划的偏差：①运行期 runState 除 activeJob 外也接受 latestJob=failed（失败后追问场景）；②anchors 注入为"位置+计数索引"段（内容已在 history，不重复传）；③Strip 与发送共用 useAgentConversation 内的同一 useAgentContext 实例。memory 项按决策 5 保持不点亮。

- **N12-01 `AgentContextPayloadSchema` + `buildAgentContext`**：schema 字段与 Strip 8 项一一对应：`{project?, snapshotIncluded, threadWindow, selection[], anchors[], runState?, memory?}`；前端 `context/buildAgentContext.ts` 从 workspace/canvas/agentBar store 组装；**ContextStrip 改为渲染该函数输出**（每项 on/off、计数、标签全部由真实数据驱动），删除硬编码 items 数组；memory 项在无实现时不点亮（决策 5）。验收：Strip 渲染 === payload 的快照单测；无选中时 selection off、有徽标时 annotations 计数正确。
- **N12-02 payload 贯通 proposeActions**：`submitMessage` 发送 `context: buildAgentContext(...)`；tRPC input + service 接收；`buildProposePrompt` 按段注入（project info / anchors 等），**未提供的项不注入也不声称**；snapshot 与 history 保持现有通道不重复传。验收：prompt 组装快照单测——"Strip 所见即 Agent 所得"。
- **N12-03 运行期上下文**：payload.runState = `{jobId, status, nodeStatuses}`；服务端检测到 jobId 时取该 job + 最近 30 条 `job_traces` 注入 `=== ACTIVE RUN ===` 段；Strip 的 run state / node runtime 项由 `activeJobId` 真实驱动。验收：运行中（或 failed 后）提问"为什么这步失败"，回复内容引用真实 trace；非运行期不注入。

### N13 · 失败路径人话化

- **N13-00 提案校验失败自动修复一轮（期末验收缺陷 1）**：schema 校验失败时不再静默丢弃——把 zod 错误摘要（≤5 条）作为 diagnostics、原始 payload 作为 failedProposal，服务端**自动重试一轮**（复用 N11-05 的 PREVIOUS PROPOSAL DIAGNOSTICS 注入；最多 1 次语义重试，内部 semanticRetry 标志防递归）。仍失败则保留 reply 返回。验收：单测——首轮坏提案/次轮好提案 → runAgent 调两次且第二轮 prompt 含诊断段、最终返回有效 proposal；两轮都坏 → reply-only。

- **N13-01 服务端 reason code**：proposeActions 六个 early-return 全部改为返回 `error: {code, detail?}`，code 枚举 `INVALID_SNAPSHOT / RUNTIME_NOT_FOUND / AGENT_FAILED / BAD_AGENT_OUTPUT`（JSON 提取/解析/校验合并为最后一项，detail 区分）；进 `ProposeActionsResponseSchema`。验收：四种 code 的单测。
- **N13-02 前端错误渲染**：code → i18n 人话（固定三段：哪里出了问题 → 为什么 → 怎么处理），"怎么处理"必须可点击——`RUNTIME_NOT_FOUND` → 跳 Settings Defaults；`AGENT_FAILED`/`BAD_AGENT_OUTPUT` → 行内 Retry（原 metadata 重发同一条消息）。复用 ErrorCard 极简样式，en+zh + story + testid。验收：停掉 runtime、断网各一例，出现可点击修复动作且动作有效。

### N14 · 逆向工程做实 ✅ 2026-06-13 完成（N15-01 一并完成）

> 执行记录：N14-01 `66a94177` / N14-02 `c92eb372` / N14-03 `26935cdf`（新增任务：系统提示词补全 nodeType 必填 data 字段——真机发现凡带输入/输出节点的提案必然校验失败的根因）/ N15-01 `9de9d999` / G2-01 `1eef6274`（mock 清查产出：导航与标题 canned 文案 i18n 化）。
> 真机验收：真实 md 样本 → 芯片显示 1.3KB → 两段分析四步真实推进 → 副标题 analyzing→drafting 真实切换 → N14-03 修复后提案一次过校验（含 folder 输入节点占位路径与输出节点）。详见 pr-assets 验收记录 N14/N15 段。
> 遗留：Retry 不携带附件全文（excerpt 降级方案待做）；N15-02 流式可选。

- **N14-01 附件读真实内容**：`ConversationAttachmentSchema` 增 `size?: number, excerpt?: string`；Composer 用 FileReader 读文本类附件（md/txt/json/csv/源码，单文件截断 32k，总量 ≤128k），二进制只传元数据并在 UI 标注"仅文件名参与分析"；**消息 metadata 只存 excerpt（前 1k）防 DB 膨胀，全文走请求 payload 不落库**；附件芯片显示大小。验收：schema 兼容测试（旧消息无新字段可读）；传 md 后 payload 含全文、DB 仅 excerpt。
- **N14-02 reversing 真两段**：service 新增 `analyzeArtifacts`（第一段调用：读结构/推步骤/匹配组件，输出 `{structure, steps[], matchedComponentIds[]}` JSON）；有附件时 proposeActions 先跑第一段，其产物注入第二段 prompt 的 `=== ARTIFACT ANALYSIS ===` 段；第一段结果随响应返回，前端 `reversingSteps` 由真实阶段驱动（两段调用完成度映射四步，删除 `AgentBar.tsx:63-72` 假 done 逻辑）。验收：上传真实 md 样本 → 进度真实推进 → proposal 内容与样本**内容**相关而非文件名猜测；对照单附件/多附件/纯二进制三例。

### N16 · Agent 创建算子与 Composer 升级（用户验收反馈，2026-06-12）

- **N16-01 proposal 支持新建 operation（最高优）**：现状 PROPOSE_SYSTEM_PROMPT 规定"ONLY use operations from the provided list"，无匹配算子时 Agent 只能拒绝（实测 PDF→Markdown 场景）。改法对齐 generateStructure 的 pendingOperations 机制：输出 schema 增 `newOperations?: [{name, description, systemPrompt}]`；服务端把它转为 pendingOperation config（executor=agent/prompt 模式，复用 generateStructure 的构造逻辑），proposal 的 addNode 可引用这些新算子 id；前端 Apply 时先 createPendingOperations 再应用图（tRPC pipelines.create 已有该参数，补 proposeActions 专用端点或复用）；ProposalCard 列表对新建算子标注 `new op`。验收：真模型说"PDF 转 Markdown"→ 得到含新算子的提案卡 → Apply 后 operation 入库、节点上画布。
- **N16-02 Composer 升级 Codex 风**：附件按钮改加号（Plus）+ 弹出菜单：Attach files / Attach folder（webkitdirectory）/ 预留扩展位（菜单结构组件化，后续可加 connector、screenshot 等）；目录上传读取文件清单作为 attachments（路径保留相对结构）。验收：files/folder 两路均可挂载并出芯片；菜单 story。
- **N16-03 发送后加载动效**：isSending 期间消息流末尾渲染 `Assistant isThinking` 行（spinner+文案，i18n），收到回复即移除；滚动跟随。验收：发消息立刻可见"思考中"，不再静默等待。
- **N16-04 Canvas operation 节点样式对照原型**：用户指出节点卡片样式与 `docs/prototype/ordien/canvas.jsx` 不符（插槽/端口样式、连线锚点观感）。逐项对照 GNodeShell 与原型 GNode（canvas.jsx 节点渲染段），输出差异清单后修复；目检截图并排存 pr-assets/。验收：与原型并排目检一致。差异清单（2026-06-12 证据级）：① `GNodeShell.tsx:65-73` 彩色 icon 主题 vs 原型中性 `bg-surface-2`（canvas.jsx:249）；② detail 行状态图标 vs 原型小圆点+执行器标签（canvas.jsx:265-267）；③ `NodeCardPorts.tsx:30-31` 端口默认隐形 vs 原型常显 12px 圆形把手 hover 放大（canvas.jsx:303-307）；④ preview 徽标单一 "new" vs 原型 new/edited/reused 三态。
- **N16-05 提案画布 ghost 预览（用户二次反馈，2026-06-12）**：`pendingProposal` 存在时所有节点统一虚线化但**提案新增的节点/边并不出现在画布上**，用户"同意前看不到要建什么"。改法：`proposalSlice` 增 `proposalPreview`（setPendingProposal 时对当前图 dry-run `applyPipelineActions`，产出 preview nodes/edges + 每节点 diff：new/modified/reuse）；CanvasFlow 在预览期渲染 preview 图并冻结编辑（drop/connect/drag/delete 全禁，Apply/Reject 仍可用）；GNodeShell 徽标按 diff 三态展示。验收：单测覆盖 addNode/addEdge 预览、失败回退 null、apply/reject 清理；真机 proposal 出卡时画布同步出 ghost 节点。
- 备注：Components 面板点击创建 operation 节点经真机验证**功能正常**（2026-06-12 冒烟）；用户感知的"创建不成功"实为 N16-01 的 Agent 路径缺失。

### N17 · 交互打磨（用户三次反馈，2026-06-12 晚）

- **N17-00 节点悬浮工具栏被裁切**：N16-04 重构时操作 pill（configure/ask/duplicate/delete，`-top-3`）留在了 `overflow-hidden` 卡片容器内，顶部被吞（用户截图为证）。修复：pill 移到外层 wrapper。✅ `cef0d41e`
- **N17-01 消息悬浮操作**：对齐 Claude 体验——用户气泡 hover 出 Copy/Edit/Retry，assistant 消息出 Copy；Edit 经 workspaceStore `composerDraft` 回填输入框并聚焦；Retry 原 metadata 重发。新组件 `messages/MessageActions.tsx`（i18n en+zh、story、testid）。✅ `1091b2b4`
- **N17-02 缺输入源主动引导**：用户实测“PDF→Markdown→HTML”两算子流水线 Apply 后直接 Run，执行器（claude-code）在控制台要求配置输入/输出文件夹，但 Agent Bar 全程沉默。Apply 成功后检测图中有 operation 节点但无输入类节点（file/folder/github-project/prompt）→ 立即追加 assistant 引导消息（点节点配置 or 让 Agent 加输入节点）。
- **N17-03 运行期执行器消息上浮** ✅ 代码完成（a `5f887e5a` / b+c `53f19a9f`，2026-06-13）。解析器 5 单测 + story + tsc/i18n 全绿；端到端真模型验证待 job `5c0650d8` 跑完后核对（执行器若未遵循协议则调整 USER_ACTION_SECTION 措辞重测），详见 pr-assets 验收记录 N17-03 段。
  - **现状证据**：执行器缺用户侧配置时只能在 stdout 抱怨（进 Run console，`OperationNode.ts:101-103` 的 onProgress 原样落 trace），Agent Bar 全程沉默；trace 结构化标记已有先例（`Pipeline.ts:310` `@@SELF_HEAL::`，前端 `runSummary.ts:41` 纯函数解析）；运行期 traces 已实时同步 `canvasStore.runTraces`（`useRunPolling.ts:96`）；waitingForUser 已有 `CheckpointCard` 上浮但无"去审核"动作。
  - **协议（N17-03a）**：执行器输出单行 `@@USER_ACTION::{"kind":"configure-input|configure-output|provide-info","message":"<给用户的一句话>","field"?:"<缺失字段>"}`；注入点 `promptExecutor.ts` 系统提示词追加 USER ACTION 规则段（与 buildOutputItemsSection 同模式）；nodeId 不要求执行器提供——解析器扫描 trace 流按 `@@NODE_START::<id>` 归属当前节点。解析器 `AgentBar/userActionRequests.ts` 纯函数 + 单测（去重：同节点同 kind 只保留最新）。
  - **渲染（N17-03b）**：`messages/UserActionCard.tsx`（i18n en+zh、story、testid），数据源 `canvasStore.runTraces` 实时派生；动作两枚：「打开节点配置」→ `setConfigNodeId(nodeId)`；「让 Agent 处理」→ `setComposerDraft(预填该请求文本)`。挂在 AgentRunCards 内 CheckpointCard 之后。
  - **checkpoint 增强（N17-03c，缩）**：CheckpointCard 在 isWaiting 时增加「去审核」按钮 → `setConfigNodeId(waitingNode.id)`（NodeConfig 含 Checkpoint 区）。
  - 验收：跑一条输入未配置的流水线 → 执行器发出 @@USER_ACTION → Agent Bar 出卡 → 点「打开节点配置」直达该节点配置面板；单测覆盖解析归属/去重/坏 JSON 容错。
- 原则备注（用户原话）：**像产品设计师一样审视细节与交互逻辑，而不是能跑就行**——每期验收前过一遍：悬浮态、空态、加载态、失败态、引导文案。

### G3 · 死交互系统盘点与修复（2026-06-13 立项，源自 N11 期末备注 5）

- **G3-00 施工计划**（本节）。范围：Jobs / Usage / Local Agents / Skills / Connectors / Components / Operations 列表与详情页 + 全局搜索 + 通知中心；Settings 页除外（N18 重做覆盖）。方法：Chrome 真机逐页 `read_page interactive` 枚举交互元素 → 逐个触发 → 三类判定：正常 / 死（无任何反应）/ 假（有反应但行为错误，如跳错页、空菜单）；同步监控浏览器 console error。产出：`pr-assets/g3-死交互盘点.md` 清单（页面 / 元素 / 期望 / 实际 / 判定 / 修复建议），盘点本身一个 docs commit。
- **G3-01 盘点执行** ✅ 2026-06-13 完成，清单见 `pr-assets/g3-死交互盘点.md`。6 个确认问题：①~~Jobs 列表行点击~~（**误报撤销**：JS 原生 click 验证抽屉正常，系宿主机浏览器缩放/翻译插件干扰扩展坐标，复证 N11 期末备注 5）②run 结束后 UserActionCard 消失（traces 仅 live 加载，实证 job 5c0650d8 的合法 @@USER_ACTION 跑完即不可见）③Usage 时间筛选只过滤 Runs 卡（Total/By pipeline/By agent 不动）④Usage 图表柱渲染为纯黑大矩形⑤通知中心声称展示 run 事件但从未派发（当天 12+ runs 零通知）⑥侧栏 Components 徽标取 operations 总数（15 vs 实际 6）。1 个误报澄清（"双语并排"系宿主机 Chrome 翻译插件）。顺带：N17-03 协议端真模型验证通过（执行器输出合法标记）。修复批次 G3-02~07 对应上述 ①~⑥。
- **G3-02+ 修复批次** ✅ 2026-06-13 完成：G3-03 `2545682d`（用户请求卡常驻 Agent Bar，run 结束/重载后回退最近 job traces——真机验证：重载后 "Action needed (1)" 卡可见，「打开节点配置」直达 NodeConfig）；G3-05 `f412ee9b`（Usage 图 maxBarSize 修黑块）；G3-06 `54b69edc`（run 终态派发通知中心事件 + 跳详情路由，每 job 去重）；G3-07 `705e652b`（Components 徽标改 pipelineAssets 同源计数）。二次勘误：G3-02（Jobs 行点击）与 G3-04（Usage 筛选）均为误报——前者系浏览器缩放/翻译插件干扰自动化（JS 原生 click 验证抽屉正常），后者三层（前端/Service/DAO）均正确传递 range，"数字不变"是 0-token runs 的数据巧合。遗留：Usage Today 范围本地时间与 DB UTC 边界错位（低优）。
- 验收：清单上每项要么修复（真机复验）要么显式隐藏并记录；console 零未处理错误。

### N18 · Settings 对照原型重做（2026-06-13 立项，源自 N11 期末缺陷 3）

> 原型基准：`docs/prototype/ordien/settings.jsx`（v2）：六组三节——Workspace（General / Notifications）· Execution（Execution / Autonomy / Limits）· Data（Data）；组导航承载于 app Sidebar（settings 路由时侧栏变形 + Back）；Keyboard 移出为帮助 modal。现状：页内左导航 language / defaults / project / keyboard / advanced / developer（`SettingsPageContent.tsx:36-43`）。

- **N18-01 六组三节结构重排** ✅ `c8af2777`（真机：Workspace/Execution/Data 三节分组导航生效，原 section 功能不回归；Notifications/Autonomy 待有内容再入导航）：SECTION_IDS 改为 general / notifications / execution / autonomy / data（+advanced/developer 归入 Data 节末尾"高级"），页内导航按三节分组渲染（节标题 Workspace/Execution/Data）；现有 LanguageSection→General、DefaultsSection→Execution、ProjectSection→Data 内容迁移（**纯迁移零行为变化，单独 commit**）。验收：六组可切换、原 section 功能不回归。
- **N18-02 General 组**：界面语言 seg（现有）+ 外观 seg（light/dark/system；若主题系统未实现则只读展示当前并注明，**不放假开关**）+ 版本信息（真实版本号，无"last checked"假数据）。
- **N18-03 Execution 组与 Defaults 联动校验** ✅ `5c856937`（失效 runtime 红色警告条 + 一键切换为首个检测 runtime 并即时保存；真机正常态验证无误报）（N11 期末缺陷 2）：默认 runtime 下拉仅列**检测到的** runtime（agentRuntimesDao 检测结果），当前值不在列表时显式警告 + 一键修正；默认 model、默认输出路径接 settings 持久化。验收：手动把 settings 写成不存在的 runtime → 页面出警告并可一键修复；Agent Bar 不再因 runtime 失配秒败。
- **N18-04 Notifications 组**：done/fail/wait/routine 四开关接 settings 持久化，通知中心（N8-02）派发时按偏好过滤。验收：关掉 done 后跑完一条 run 无通知，fail 仍有。
- **N18-05 Autonomy 组（真实生效）**：self-heal 轮数 stepper（0-5）接 settings，`Pipeline.ts:34` SELF_HEAL_MAX_RETRIES 改为读运行时设置；三个 ask 开关字段持久化（执行面后续接，UI 注明当前仅存储——若注明成本高则整组只做 healRounds）。验收：healRounds=0 时失败节点不重试（trace 无 @@SELF_HEAL）。
- **N18-06 Data 组**：数据目录展示（真实 PGLITE/输出路径）+ 清除对话历史（接 conversationMessages 删除，二次确认）；retention 自动清理无后端机制则**不放 UI**，记遗留。
- **N18-07 Keyboard 帮助 modal**：KeyboardSection 改为 PageHeader 帮助按钮触发的 modal（原型 KeyboardHelpModal），导航中移除 keyboard 组。
- **N18-08 侧栏变形（可选，最后）**：settings 路由时 AppSidebar 渲染设置组导航 + Back；若侵入面过大则保持页内导航并记遗留（页内三节分组已满足信息架构对齐）。
- **Limits 组：本期不做**——成本上限需要 runner 真实执行才不算假透明，列入下期（依赖 run cost 统计通道）。
- 纪律：每任务单独 commit（`<type>: <中文描述> (N18-0x)`）；新组件 i18n en+zh + story + testid；期末真机走查全部组 + 截图记录。

### N15 · 阶段事件与流式（可与 N13/N14 穿插，N15-02 可暂缓）

- **N15-01 粗粒度阶段事件**：利用 `runAgent` 的 `onProgress` 钩子 + 服务端内存态（或 tRPC subscription，二选一以实现成本定）暴露 `thinking → drafting → validating` 阶段；前端 isThinking 行副标题实时更新（含 reversing 两段的阶段转发）。验收：发消息后副标题至少经历两次真实变化，非定时器伪造。
- **N15-02 reply 流式（可选）**：token 级流式渲染 assistant reply。非阻断项，做不进本轮则记入遗留。

### N16 · 最终验收清单（合并前必过）

- [ ] 选中节点/边/钻入子节点 → 发消息 → LLM 提案针对选中元素（含 replaceNodeData 正确 nodeId）
- [ ] 两轮对话指代消解；Revise 后新提案体现拒绝原因；diagnostics → Ask agent to fix → 新提案过校验
- [ ] 模糊请求得到 ≤4 个追问芯片，点击芯片推进到 proposal；clarify 分支 UI 与原型目检一致
- [ ] ContextStrip 每一项的亮灭/计数与实际发送 payload 完全一致（快照测试为证）；memory 项不再恒亮
- [ ] 运行期提问获得引用真实 trace 的回答；失败时三段式人话 + 可点击动作（Settings / Retry 各验一例）
- [ ] 上传样本 → 真实两段分析 → 进度真实推进 → proposal 与样本内容相关
- [ ] 全部 assistant 文案走 LLM reply 或 i18n（en+zh），grep 零 canned 英文
- [ ] `proposeActions/` 无文件 >200 行；`createPipelinesService.ts` 显著瘦身；knip 清零
- [ ] 每个 N 任务单独 commit + 真 LLM 手测记录（截图/录屏存 pr-assets/）

---

## 五、给执行 agent 的特别警告

1. **校验链是底线不是负担**：`validatePipelineActions` + operation 目录校验 + `normalizeProposalPayload` 一行都不能绕过或弱化；prompt 改造后必须重跑全部 normalize 兼容单测。
2. **N11-00 的迁移必须零行为变化**——先迁移后改造，两件事绝不混在一个 commit。
3. **上下文只有一个事实源**：发现自己在 ContextStrip 和发送逻辑里分别写了一份"上下文构成"= 方向错了，回到 `buildAgentContext`。
4. **不准为了"让 Agent 显得聪明"伪造任何进度**：reversing 步骤、阶段副标题、自愈行——所有进度展示必须由真实事件驱动；做不到真实就显示一个诚实的 spinner。
5. **phase 推进仍禁止扩散**：clarify/proposal 的 setPhase 只在 `useAgentConversation` 内；DebugPhaseBar 除外。
6. **附件全文不落库**：conversation_messages 的 metadata 只存 excerpt；全文只走请求体。违反 = DB 膨胀 + 隐私问题。
7. 每完成一个 N 任务：真 LLM 手测 → 截图存 pr-assets/ → `bun run format` → `bun run quality` → 单独 commit（`<type>: <中文描述> (N11-01)`）。**prompt 改动必须附手测记录，单测绿不等于提案质量好。**

---

## 六、N11 期末真实验收记录（2026-06-12 · claude-code 真模型）

**已通过**：

- 模糊请求（"帮我处理一下文件"）→ Agent 中文追问 + 4 个 clarify 芯片（内容结合了真实 operations 目录）✅
- 点芯片 → 选项原文发送 → 第二轮带对话历史正确推进 ✅（N11-02/03/04 闭环）
- New Pipeline 创建 500 已修复并真机验证（`N11-fix-01`：localStorage 失效 projectId 自动清理）✅

**新发现缺陷（进入下一期）**：

1. **提案静默丢弃（高优）**：第二轮 Agent 回复"已搭建 10 节点流水线"，但其 proposal 未过 `PipelineActionProposalSchema` 校验被丢弃——无 ProposalCard、画布无预览，回复内容与实际行为矛盾。归 N13-01：校验失败时返回 error code + 把 zod 错误摘要作为 diagnostics 注入自动重试一轮（最多一次），仍失败则前端明示"提案生成失败已丢弃"。
2. **默认 runtime 可为不存在的值**：settings 默认是 `mastra`（不在检测列表/下拉选项中），导致 Agent Bar 全部秒败且无任何提示。归 N13：runtime 不可用时返回 RUNTIME_NOT_FOUND code + 可点击跳 Settings；Defaults 下拉与检测结果联动校验。验收时已手动切到 claude-code 并清空 default model。
3. **Settings 页与原型不符**：现为 Language&Region/Defaults/Project/Keyboard/Advanced/Developer 平铺，原型（settings.jsx）应为 General/Defaults/Project/Keyboard/Account/Advanced 六组 + 侧栏变形 Back 导航。
4. **Canvas 卡片与连线样式与原型（canvas.jsx）有偏差**：节点卡片插槽样式、边的连接锚点观感不符，需逐项对照（用户截图为证）。
5. 自动化误报说明:"Settings 点击无效"经 JS 验证为浏览器扩展坐标缩放问题,非应用缺陷;真实死交互需系统盘点后另列。
