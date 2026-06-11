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

### N12 · 上下文透明做实（ContextAssembler 单一事实源）

- **N12-01 `AgentContextPayloadSchema` + `buildAgentContext`**：schema 字段与 Strip 8 项一一对应：`{project?, snapshotIncluded, threadWindow, selection[], anchors[], runState?, memory?}`；前端 `context/buildAgentContext.ts` 从 workspace/canvas/agentBar store 组装；**ContextStrip 改为渲染该函数输出**（每项 on/off、计数、标签全部由真实数据驱动），删除硬编码 items 数组；memory 项在无实现时不点亮（决策 5）。验收：Strip 渲染 === payload 的快照单测；无选中时 selection off、有徽标时 annotations 计数正确。
- **N12-02 payload 贯通 proposeActions**：`submitMessage` 发送 `context: buildAgentContext(...)`；tRPC input + service 接收；`buildProposePrompt` 按段注入（project info / anchors 等），**未提供的项不注入也不声称**；snapshot 与 history 保持现有通道不重复传。验收：prompt 组装快照单测——"Strip 所见即 Agent 所得"。
- **N12-03 运行期上下文**：payload.runState = `{jobId, status, nodeStatuses}`；服务端检测到 jobId 时取该 job + 最近 30 条 `job_traces` 注入 `=== ACTIVE RUN ===` 段；Strip 的 run state / node runtime 项由 `activeJobId` 真实驱动。验收：运行中（或 failed 后）提问"为什么这步失败"，回复内容引用真实 trace；非运行期不注入。

### N13 · 失败路径人话化

- **N13-01 服务端 reason code**：proposeActions 六个 early-return 全部改为返回 `error: {code, detail?}`，code 枚举 `INVALID_SNAPSHOT / RUNTIME_NOT_FOUND / AGENT_FAILED / BAD_AGENT_OUTPUT`（JSON 提取/解析/校验合并为最后一项，detail 区分）；进 `ProposeActionsResponseSchema`。验收：四种 code 的单测。
- **N13-02 前端错误渲染**：code → i18n 人话（固定三段：哪里出了问题 → 为什么 → 怎么处理），"怎么处理"必须可点击——`RUNTIME_NOT_FOUND` → 跳 Settings Defaults；`AGENT_FAILED`/`BAD_AGENT_OUTPUT` → 行内 Retry（原 metadata 重发同一条消息）。复用 ErrorCard 极简样式，en+zh + story + testid。验收：停掉 runtime、断网各一例，出现可点击修复动作且动作有效。

### N14 · 逆向工程做实

- **N14-01 附件读真实内容**：`ConversationAttachmentSchema` 增 `size?: number, excerpt?: string`；Composer 用 FileReader 读文本类附件（md/txt/json/csv/源码，单文件截断 32k，总量 ≤128k），二进制只传元数据并在 UI 标注"仅文件名参与分析"；**消息 metadata 只存 excerpt（前 1k）防 DB 膨胀，全文走请求 payload 不落库**；附件芯片显示大小。验收：schema 兼容测试（旧消息无新字段可读）；传 md 后 payload 含全文、DB 仅 excerpt。
- **N14-02 reversing 真两段**：service 新增 `analyzeArtifacts`（第一段调用：读结构/推步骤/匹配组件，输出 `{structure, steps[], matchedComponentIds[]}` JSON）；有附件时 proposeActions 先跑第一段，其产物注入第二段 prompt 的 `=== ARTIFACT ANALYSIS ===` 段；第一段结果随响应返回，前端 `reversingSteps` 由真实阶段驱动（两段调用完成度映射四步，删除 `AgentBar.tsx:63-72` 假 done 逻辑）。验收：上传真实 md 样本 → 进度真实推进 → proposal 内容与样本**内容**相关而非文件名猜测；对照单附件/多附件/纯二进制三例。

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
