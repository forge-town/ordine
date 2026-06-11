# Ordine 重构施工手册 v2（含设计稿差异审查）

> 2026-06-11 · 本文档**取代** `docs/canvas-v2-plan.md`（Canvas V2 重写施工手册），成为下一阶段的**唯一施工计划**。
> 前置：refactor-plan（M1–M8）已全部完成；Canvas V2 手册的 **N0、N1-01～N1-07、N2-01～N2-03 已完成**（commit `f6e1ad2f` … `3510d8f5`）。本手册从 N3 起继续编号，并按**最新 Ordien 设计稿**修订了 N3 之后的全部任务。
> 执行规则与质量门沿用 refactor-plan §0/§3：neverthrow 零 try-catch、Zod 唯一真相、单文件单职责（~200 行红线）、一任务一 commit（`<type>: <中文描述> (N3-01)`）、`bun run format` + `bun run quality` 全绿。**外加两条硬性验收：所有新组件必须走 useTranslation（en+zh 同步加键）；交互组件必配 story 和 data-testid。**

---

## 0. 视觉原型：Ordien 设计稿（唯一像素参照）

设计稿分两层，**顶层文件覆盖嵌套同名文件**（这是最新一轮迭代的组装规则，对应 `index.html` 的加载顺序）：

| 原型文件 | 取自 | 内容 |
|----------|------|------|
| `index.html` / `app.css` | **顶层（最新）** | Tailwind token、动画、画布网格——设计系统唯一来源（与已落地的 styles.css 基本一致，新增 `paused` 状态样式核对） |
| `lib.jsx` | **顶层（最新）** | 共享小组件；相对旧版仅新增 `paused` StatusPill（lib.jsx:42） |
| `workspace.jsx` | **顶层（最新）** | ★ 全新 Agent Bar（极简 Codex 风）+ Select→Prompt 批注统一 + ContextStrip + Workspace 编排 |
| `jobs.jsx` | **顶层（最新）** | ★ 全新 Jobs 控制台：List + Calendar 双视图 + RoutineStore 全局共享 |
| `canvas.jsx` | 嵌套 `ordine-fork (1)/` | Canvas 全部交互（手写实现仅作视觉/交互参照，工程上继续用 @xyflow/react） |
| `panels.jsx` | 嵌套 | JobDetailDrawer、ScheduleEditor、UsageRunModal |
| `pages.jsx` | 嵌套 | 7 个二级页面（其中 Jobs 段已被顶层 jobs.jsx **整体取代**） |
| `wizards.jsx` | 嵌套 | Add/Manage Connector、Import Skill、Configure Agent、Find-for-me、Skill 详情 |
| `settings.jsx` | 嵌套 | Settings 六分组全页 |
| `shell.jsx` | 嵌套 | Sidebar（可拖拽/可收起）、通知中心、全局搜索、Settings 侧栏变形、SignOut；MacWindow/ScaledStage 为演示外壳**不实现** |
| `runtime.jsx` | 嵌套 | RunConsole、CheckpointDialog、StateLegend、VersionMenu + 演示运行数据（行为参照，不抄实现） |

执行第一个任务前，先把组装后的原型放进仓库 `docs/prototype/ordien/`（N3-00）。

**原型中的演示装置，一律不实现**：MacWindow 外壳、ScaledStage 缩放台、walkthrough 阶段步进器（canvas.jsx:1279-1292）、Seed sample pipeline 按钮（仅 DEV 保留）、关键词模板回复（workspace.jsx:393-400）。

---

## 一、设计稿差异审查（v2 相对旧原型改了什么）

逐文件 diff 结论，按影响排序：

### 1.1 Agent Bar 推倒重做为"极简 Codex 风"（workspace.jsx 顶层 vs 嵌套，263 行 diff）

- **卡片 chrome 全部删除**：原 ProposalCard/RunStatusCard/CompletionCard/DistillCard 等重卡片不复存在。助手消息=纯文本（`Assistant` 只剩一个 text div，workspace.jsx:47-49）；进度=左边框列表（`border-l border-border pl-3`，:85-95、:123-129）；动作=行内小按钮或下划线链接（:96-98、:130-134、:176-178）。
- **头部极简**：状态点（running 时 pulse）+ "Agent" + 阶段副标题一行（:311-318），副标题文案映射 :302-304。Clear 按钮从头部移除。
- **新增 `reversing` 阶段**（:75-101）：上传样本后展示"Read structure → Inferred steps → Matched components → Drafting pipeline"四步进度。阶段全集 = `empty / reversing / clarify / proposal / applied / running / done`。
- **running 态**：行内 job 摘要（`job_8f2a · step 3/5 · 14.6s · $0.14`，:152-154）+ 自愈折叠行（:155-166）+ 连接器中断提示带**可点击** "Connect Notion" 链接（:167）。
- 思考中消息=行内 spinner + 文本（:197-201）。

### 1.2 批注层与对话合并：Select → Prompt（缺口盘点文档 §二 的方案在新 workspace.jsx 已全量落地）

- 结构化引用：canvas `onSelRefs` 上报 `{id, type:"node"|"edge", baseId, label, kind, path}`，钻入路径编码进 id（canvas.jsx:640-648）；边可被引用。
- RefChips 双向联动：hover 高亮画布元素、click spotlight 定位（workspace.jsx:11-28；canvas.jsx:651-675 的 spotlight/fit 逻辑）。
- 节点 "Ask"：悬停操作栏 Sparkles 按钮 → AskComposer 弹窗（canvas.jsx:576-598）→ 提交 = 主对话流发一条带该节点 ref 的消息（workspace.jsx:402-414）。
- 节点徽标 = 未 resolve 的锚定消息数（workspace.jsx:386-391）；点徽标 → Agent Bar 线程视图（按 ref 过滤 + Show all 退出 + 逐条 ✓ resolve，workspace.jsx:320-331、184-208、423-426）。
- 框选多节点的浮条新增 **"Ask about selection"**（canvas.jsx:1242-1256）。
- **AnnComposer/AnnViewer/annotations 独立便利贴机制废弃**——批注=带 referencedNodeIds 的 conversation_messages（+ resolved），`annotations` 表保留但 v1 主路径不再使用。

### 1.3 ContextStrip 上下文透明条（workspace.jsx:211-253，全新）

Composer 上方可展开行：8 个上下文项（Project info / Pipeline snapshot / Conversation thread / Selection / Canvas annotations / Run state / Node runtime / Memory summary），各带注入规则标签，running 时 Run/Runtime 置顶点亮。Selection / annotations 项由真实选中与徽标数据驱动（旧版 `on:false` 硬编码问题已修正）。

### 1.4 Jobs 页整体取代为"机群控制台"（jobs.jsx 全新，原 pages.jsx Jobs 段废弃）

- List 视图：6 列表格（Job / Status / Started / Duration / Cost / Actions），行内按状态给操作（running→Pause/Stop，paused→Resume/Stop，queued→Cancel，终态→Rerun，**waitingForUser→实心 Review**，jobs.jsx:113-148）；统计卡删除，换一行文字摘要（:316-320）。
- Calendar 周视图（:160-264）：过去运行实块 + 未来 cron Routine 虚线幽灵块同网格；事件触发 Routine 顶部 live 条（:200-210）；now 红线（:252-257）；重叠分列（:224-228）；点幽灵块直接编辑 Routine。
- **RoutineStore 全局一份**（:33-44）：Pipelines 卡片 Schedule 芯片与 Jobs 页读写同一份 Routine 列表。
- Job 状态新增 **`paused`**（lib.jsx:42 新增 StatusPill；opsActions :115）。

### 1.5 应用壳能力（shell.jsx，上一迭代已含、旧 M 系列未覆盖的部分）

- 侧栏与 Agent Bar **可拖拽调宽 + 阈值收起 + 边缘把手唤回**（ResizeHandle，shell.jsx；Workspace 右栏 300–520/阈值 248，workspace.jsx:375-379、436-447；侧栏 200–360/阈值 168）。Agent Bar 变为浮动圆角面板（`rounded-2xl ring-1 shadow-float`，workspace.jsx:437-446）。
- **通知中心**：标题栏铃铛 + 未读角标 + 历史列表（kind 图标/时间/路由跳转/已读/清空）；notify() 同时进 toast 与历史。
- **全局搜索**：侧栏搜索框检索 7 类实体分组展示（GlobalSearchResults）。
- **Settings 全页**：进入后侧栏变形为 Back + 六分组导航（General/Defaults/Project/Keyboard/Account/Advanced，settings.jsx）。
- **SignOut 覆盖层**、用户菜单四项跳转、主题切换（dark 仅 preview）。

### 1.6 Canvas 增量（canvas.jsx + runtime.jsx，上一迭代新增）

- **VersionMenu**（runtime.jsx:186-231）：药丸内 `v3 · draft · saved / unsaved` + Overwrite / Save as new version + 历史列表。
- StateLegend 9 态图例（runtime.jsx:154-183）；CheckpointDialog 增加 **Edit step**（暂存 checkpoint → 开 NodeConfig → 关回弹卡，canvas.jsx:807-808）。
- 复制/粘贴/Duplicate 快捷键（⌘C/V/D，canvas.jsx:712-731、1085-1087）。
- 节点悬停操作栏第二位从 "Annotate" 改为 **"Ask"**（canvas.jsx:241）。
- proposal 预览 diff 标签三态：`new / edited(modified) / reused`（canvas.jsx:255-260）。

### 1.7 二级页面增量（pages.jsx + wizards.jsx，需与已完成的 M7 对账）

M7 已按旧原型重做 7 页；本轮需补：PipelineCard 的 Schedule 芯片（pages.jsx:108-115）、ComponentEditor 复用 NodeConfig + "used in N pipelines" banner（:215-233）、ConfirmDialog 统一删除确认（:235-250）、FindForMeModal、UsageRunModal 按 run 钻取（:454-530）、Capabilities 三页的向导/抽屉全套（wizards.jsx）、Skills/Connectors 卡片悬停 Edit/Delete。

---

## 二、处置决策

1. **Canvas V2 续建不返工**：N1/N2 已落地的 `WorkspacePage/canvas/`（store 切片、nodes、edges、flow、CanvasRoot）符合新设计稿，继续在其上加 chrome 与面板。
2. **AgentBar 不推倒目录，推倒视觉**：保留 `useAgentConversation` / persistence / agentBarStore 的逻辑层；messages/ 下重卡片组件改写为极简元件（删多于改）。proposal/run/done 的数据流不变，渲染层换皮。
3. **批注主路径切到 conversation_messages**：`annotations` 表与 DAO/Service 保留不删（资产化批注后续可能用），但 UI 不再走它；徽标/线程全部由消息的 `metadata.referencedNodeIds` + `resolved` 驱动（metadata schema 需扩展 `resolved`，向后兼容）。
4. **Jobs 页二次重做**：M7-03 的版本按新 jobs.jsx 整体替换（统计卡删、Routines 区并入 Calendar/编辑器）。Routine 数据走 M1/M2 已建的 `routines` 表与服务，不再页面内自持。
5. **phase 仍是派生状态**（derivePhase 已落地）：新增 `reversing` 进 `WorkspacePhaseSchema`，由"存在进行中的逆向分析任务"派生，同 clarify 一样属 AgentBar 局部触发的临时态——**仍然禁止业务 setPhase**。
6. 视觉规格 = `docs/prototype/ordien/`；工程上 Canvas 继续 @xyflow/react，原型手写画布只作参照。

---

## 三、目标架构（增量部分）

```
WorkspacePage/
  WorkspacePage.tsx                     ← 接 ResizeHandle、浮动 AgentBar 容器
  _store/workspaceStore.ts              ← refs 结构化升级（含 baseId/kind/path）、spotlight/hoverRef/thread 状态
  AgentBar/
    AgentBar.tsx                        ← 极简头部（点+Agent+副标题）+ 线程条
    AgentBody.tsx                       ← 七阶段极简渲染（含 reversing）
    messages/                           ← 重卡片删除，保留/新增：Assistant(纯文本)、Bubble、ProgressList(左边框)、
                                           InlineAction、SelfHealRow、ThreadEmpty …（一组件一文件）
    Composer/Composer.tsx               ← 附件上传、Enter 发送
    Composer/RefChips.tsx               ← 双向联动芯片（替代 RefTagBar）
    Composer/ContextStrip.tsx           ← 上下文透明条
    useAgentConversation.ts             ← 消息带 refs/atts/resolved；reversing 状态机
  canvas/
    chrome/TopPill.tsx                  ← 面包屑+改名+VersionMenu+Run/Stop+StateLegend+Agent 唤回
    chrome/VersionMenu.tsx
    chrome/CanvasToolbar.tsx            ← 右下：select/hand/缩放/复位
    chrome/ComponentPanel.tsx           ← 左上浮动可收起
    panels/NodeConfig/  EdgeInspector/  ← 自 CanvasPage 搬运改造
    ask/AskComposer.tsx                 ← 节点就地提问弹窗
    compose/ComposeBar.tsx              ← 多选浮条（Compose + Ask about selection）
    drill/                              ← 面包屑钻入钻出（graphSlice 已有数据面）
    run/RunConsole.tsx  CheckpointDialog.tsx
JobsPage/                               ← 二次重做：TableView/CalendarView/JobDetailDrawer/ScheduleEditor
components/
  AppSidebar/                           ← ResizeHandle、收起把手、搜索结果面板、Settings 变形态
  NotificationCenter/
  ResizeHandle/
SettingsPage/                           ← 六分组重做
```

行数预算：`canvas/` 单文件 ≤300；AgentBar messages 单文件 ≤120；JobsPage CalendarView ≤260。

---

## 四、任务拆分（续 N 系列，按序执行）

### N3 · 画布浮动 Chrome

- **N3-00 原型入库与基线**：把组装后的 Ordien 原型放 `docs/prototype/ordien/`（顶层覆盖嵌套）；`bun run quality` 记录基线追加到 `docs/refactor-baseline.md`；**当前工作区有一组未提交的 SkillToOperationDialog/skills 路由改动——先确认归属（合入或 stash），保持干净树再开工**。验收：树干净、基线已记。
- **N3-01 `chrome/TopPill.tsx` + `chrome/VersionMenu.tsx`**：画布顶部左侧浮动药丸（absolute 不占高）：面包屑（root 可点改名，钻入层级可点回跳，对照 canvas.jsx:1112-1148）+ VersionMenu（runtime.jsx:186-231：版本号+dirty 点+Overwrite/Save as new+历史；持久化先接 pipelines 表 `version` 字段——**schema 任务**：pipelines 加 `version int default 1` + 迁移 0030，快照另存沿用 pipeline_assets）。右侧：StateLegend（runtime.jsx:154-183）+ Run/Stop 按钮（运行中变 Stop，终态文案 Re-run，canvas.jsx:1150-1158）+ AgentBar 收起时的 "Agent" 唤回按钮（:1159-1164）。Run 可用性沿用 derivePhase 解耦规则。验收：改名持久化；版本另存后刷新仍在；目检对照原型截图。
- **N3-02 `chrome/CanvasToolbar.tsx`**：右下浮动（canvas.jsx:1295-1304）：select/hand 工具切换、缩小、百分比复位、放大。验收：hand 拖拽平移、百分比实时。
- **N3-03 `chrome/ComponentPanel.tsx`**：左上浮动 "Components" 药丸开关 + 230px 面板（canvas.jsx:1169-1199）：分组 = Input Objects(内置4) + Operations(useList) + Compound(verify/council/delegation) + Output(内置)；点击置中创建 + 拖拽落点创建（复用已搬运的 canvasComponentDragPayload）；拖入时画布虚线框提示（:1236）。验收：拖 operation 到画布生成正确节点；收起后画布满幅。
- **N3 整体验收**：三件 chrome 全部浮动；无 dock 面板、无整宽顶栏；与原型并排目检截图存 pr-assets/。

### N4 · 面板、复合与运行态 UI

- **N4-01 `panels/NodeConfig/`**：自 CanvasPage 搬运（只复制不在旧目录改），接 panelSlice；分区 = Prompt/Executor(Agent 下拉 + Skill|MCP 二选一 tab)/Status·last run/Checkpoint 开关（canvas.jsx:406-526）；Done 提交 + Reset 回滚（cfgSnapshot 模式）。验收：双击节点开面板，改 prompt/executor 刷新保留；Reset 回滚正确。
- **N4-02 `panels/EdgeInspector/`**：搬运改造（canvas.jsx:529-573）：字段映射三列（源字段/开关/目标输入），toggle 写回 `edge.data.dataContract.mappings[].enabled` 并持久化；Unlink 删边。点击边打开（panelSlice.inspectEdgeId 已有）。验收：toggle 后刷新仍在；删边可撤销。
- **N4-03 compose + drill**：框选 ≥2 节点出顶部浮条（canvas.jsx:1242-1256）："Compose into compound"（graphSlice compose 已有，补跨界边重连单测）+ "Ask about selection"（留接口，N5-06 接通）+ 清除；双击复合节点钻入、面包屑/Esc 钻出、钻入提示条（:1201-1208）。验收：合成→钻入→编辑→钻出→刷新结构不丢。
- **N4-04 运行态 UI**：`run/RunConsole.tsx`（runtime.jsx:59-100：底部折叠抽屉、流式行、@@NODE_START/DONE 分组着色）接 runSlice 的 job_traces 轮询；`run/CheckpointDialog.tsx`（runtime.jsx:103-140：Approve & continue / **Edit step**（开 NodeConfig 后回弹）/ Stop）接 M8-C 后端；节点状态灯/进度条/边 flow 动画由 runSlice 驱动（GNodeShell 已支持 9 态）。验收：跑真实 pipeline，灯/边/console/checkpoint 全链路与 DB nodeStatuses 一致。

### N5 · Agent Bar 极简化 + Select → Prompt（本轮核心）

- **N5-01 结构化 refs**：`WorkspaceCanvasRef` 升级为 `{id, baseId, type:"node"|"edge", label, kind, path:string[]}`（进 @repo/schemas `pipeline/WorkspaceCanvasRefSchema.ts`）；canvas selectionSlice 上报含钻入路径（id=`n4/vc` 形态，label 带层级前缀，对照 canvas.jsx:640-648）；**边选中进 refs**（与 EdgeInspector 并存）。验收：单测覆盖 root/钻入/边三种 ref 构造。
- **N5-02 芯片双向联动**：`Composer/RefChips.tsx`（workspace.jsx:11-28）：hover → workspaceStore.hoverRef → 画布对应元素 ring 高亮（GNodeShell 加 highlight prop）；click → spotlight `{ref, nonce}` → canvas 切到 ref.path 层级并 fit 定位选中（canvas.jsx:651-675 的两段 useEffect 翻译成 xyflow `setCenter/fitView`）；芯片可移除（dismissed，选区变化时重置 dismissed，workspace.jsx:382-383）。验收：hover 高亮、click 定位（含钻入层）、移除后发送不带该 ref。
- **N5-03 AgentBar 极简改造**：头部换为点+Agent+副标题映射（workspace.jsx:302-318）；`AgentBody` 七阶段重写（empty 建议行 :56-71 / reversing 四步进度 :75-101 / clarify 选项芯片 :103-116 / proposal 左边框列表+Apply/Revise/Reject :118-137 / applied 一句话 :139-146 / running 摘要+自愈折叠+中断链接 :148-170 / done 总结+资产链接 :172-180）；messages/ 重卡片（ProposalCard/RunStatusCard/CompletionCard/DistillCard/ErrorCard/SelfHealCard…）替换为极简元件并删除死组件（i18n 键同步清）。中断提示里的 "Connect Notion" 必须真实 `navigate({to:"/connectors"})`。验收：七阶段逐一与原型并排目检；旧卡片组件全删、knip 清零。
- **N5-04 `Composer/ContextStrip.tsx`**（workspace.jsx:211-253）：8 项上下文+规则标签+running 优先级切换；Selection/annotations 项由 refs 与徽标计数真实驱动；展开态 fade-rise。发送 payload 按此结构组装传给 proposeActions（pipeline 快照、refs 全文、锚定消息、运行态）。验收：交互单测（展开/计数/运行态切换）；payload 快照测试。
- **N5-05 Composer 附件 + 发送**：真实文件选择（多选、可移除，workspace.jsx:262-284）；attachment 元数据存消息 metadata；Enter 发送/Shift+Enter 换行/空禁发已有则保留。上传样本触发 reversing：消息含附件且会话为空 → useAgentConversation 进入 reversing 状态机（先用固定四步进度 + 后端 proposeActions 完成后转 proposal）。`WorkspacePhaseSchema` 增 `reversing`（兼容测试）。验收：传样本→reversing→proposal 全链路。
- **N5-06 节点 Ask + 多选 Ask**：GNodeShell 悬停操作栏第二键改 "Ask"（Sparkles）；`ask/AskComposer.tsx` 弹窗（canvas.jsx:576-598，定位在节点右上、Esc 关闭）提交 = sendMessage(text, {refs:[该节点]})；多选浮条 "Ask about selection" = 聚焦 Composer 且 refs=选区（workspace.jsx:418）。验收：Ask 后消息带正确 ref 且画布徽标 +1。
- **N5-07 徽标与线程视图**：`ConversationMessageMetadataSchema` 增 `resolved?: boolean`（兼容测试）；徽标计数 = 未 resolve 且引用该节点的消息数（workspace.jsx:386-391），GNodeShell 已有 annotationCount 入口改接此数据；点徽标 → AgentBar 线程模式（顶部 Thread 条 + Show all，workspace.jsx:320-331；消息行 hover 出 ✓ resolve，:184-208）；resolve 写回消息 metadata 并持久化。**AnnComposer/AnnViewer/useAnnotations 旧批注组件停用归档**。验收：发锚定消息→徽标+1→线程过滤正确→resolve→徽标-1→全清徽标消失→刷新仍一致。
- **N5-08 对话持久化适配**：conversation_messages 读写补 refs（referencedNodeIds→结构化 refs 序列化进 metadata）、atts、resolved；进入 workspace 按 pipelineId 拉历史，徽标计数由历史推导。验收：刷新后对话/徽标/线程全在。

### N6 · 新建 / 打开 / 运行链路收口（原 N5 修订）

- **N6-01 新建**：PipelinesPage New Pipeline → id 用 `crypto.randomUUID()`（若仍有 `Date.now()` id 残留则修）；创建后跳 workspace，**无任何 setPhase**（派生为 empty）；AgentBar empty 态建议项含"上传样本逆向"。验收：快速连点不撞 id；新建即 empty 态。
- **N6-02 打开**：装载含节点 pipeline → derivePhase 给 applied、Run 可用；历史对话与徽标恢复。
- **N6-03 Run/Stop**：TopPill Run → `pipelines/:id/run`（M6 链路）；运行中 Stop → 取消 job：当前步 cancelled、下游 skipped（语义对照 canvas.jsx:790-804）；完成后资产沉淀提示用 N5-03 的极简行内样式。**DEV phase 调试条删除**，换 `?debug=phases` 才显示的独立 DebugPhaseBar。
- **N6 验收**：新建→拖 2 节点连线→Run 跑通；打开旧 pipeline→直接 Run；上传样本→reversing→proposal→Apply→Run；三条路径全绿 + 截图。

### N7 · Jobs 控制台 V2（二次重做 M7-03）

- **N7-01 schema/服务对账**：JobStatus 枚举核对并补 `paused`（兼容测试：旧值原样过）；jobs 控制端点盘点——pause/resume/stop(cancel)/rerun 四个动作，缺的补 `jobsService` 方法 + Hono/tRPC 路由（rerun = 以同 pipeline+输入新建 job）；routines 服务核对 `getEnabled`/nextRunAt 推导可用。验收：curl 四动作各一轮。
- **N7-02 `ScheduleEditor`**（panels.jsx:216-305）：Manual/Cron/On event 三段切换；cron 预设 4 枚 + 5 段表达式逐位输入 + 人话 summary；事件枚举芯片；Input source/Output channel 选择器；启停开关；编辑模式带删除。写 `routines` 表。验收：新建/编辑/删除/启停各一例，Pipelines 卡片同步可见。
- **N7-03 List 视图**：JobsPage 重排——PageHeader actions = New Routine + New Run；Seg 切换 List/Calendar；List = 表格 6 列 + 行内动作（jobs.jsx:113-148，waitingForUser 亮 Review 开详情）+ 摘要行（:316-320）+ 搜索；旧统计卡/JobRow/Routines 区删除（i18n 键清理）。动作走 N7-01 端点，乐观更新 + 失败回滚。验收：四种动作行内可用且 DB 状态变更。
- **N7-04 Calendar 视图**（jobs.jsx:160-264）：周网格 05:00–21:00；今天列来自真实 jobs，过去日来自 jobs 历史查询，未来块由 enabled 的 cron routine 推导（ghost，点开编辑该 routine）；事件 Routine live 条；now 红线；重叠分列；周导航 + Today + 图例 + Schedule 按钮。验收：增删 Routine 幽灵块即时增减；点块行为正确。
- **N7-05 `JobDetailDrawer`**（panels.jsx:45-162）：右滑抽屉 = 头部(pipe/id/by/started/StatusPill) + 控制行(按状态 Pause/Resume/Stop/Re-run + tok/cost 合计) + 逐步骤折叠列表（序号/状态点/RunBadge/耗时/trace 彩色行，数据来自 jobs.nodeStatuses + job_traces）+ "Open pipeline on canvas"。验收：与 DB trace 一致；控制动作生效。
- **N7-06 Pipelines 页 Schedule 芯片**：PipelineCard 右上 Schedule/Routine 芯片（pages.jsx:108-115，有 routine 时反色），点开 ScheduleEditor 绑定该 pipeline。验收：设置后 Jobs 周历立刻出现幽灵块。

### N8 · 应用壳与二级页补全

- **N8-01 可拖拽布局**：`components/ResizeHandle/`（shell.jsx 的 ResizeHandle：宽把手、hover 指示、双击收起）；侧栏 200–360/阈值 168 收起 + 左缘唤回把手；AgentBar 容器改浮动圆角面板（py-1.5 pr-1.5 + rounded-2xl ring shadow-float）300–520/阈值 248 收起。宽度持久化 localStorage。验收：拖拽、阈值收起、唤回、刷新记忆。
- **N8-02 通知中心**：`components/NotificationCenter/`（shell.jsx NotifBell/NotifCenter）：全局 notifStore（zustand，append 上限 60）；现有 toast 调用点统一改走 `notify(msg, kind, route?)` 双写；标题栏（_layout 顶部右侧）铃铛+未读数；面板含 kind 图标/timeAgo/未读点/路由跳转/Mark read/Clear。运行完成、自愈、失败、连接器待授权、资产沉淀五类事件接入。验收：触发各类事件后历史可回看可跳转。
- **N8-03 全局搜索升级**：M7-08 的结果面板扩展到 7 组（Pipeline/Node/Component/Job/Skill/Connector/Agent，shell.jsx GlobalSearchResults 的分组样式）；Node 命中跳 workspace 并 spotlight 该节点（接 N5-02）。验收：各组检索命中且直达。
- **N8-04 Settings 重做**：`SettingsPage/` 六分组（settings.jsx）：General（语言 en/zh 即时切换、外观 Light/Dark(preview)/System、启动页）、Defaults（settings 表 4 字段 + key 掩码/旋转）、Project（当前 project 名称/描述/归档）、Keyboard（快捷键速查静态表，对照 settings.jsx:71-75）、Account（本地身份 + Sign out）、Advanced（数据目录/迁移版本只读 + 清空对话 + 重置危险区二次确认）。侧栏进入 Settings 变形为 Back+分组导航（shell.jsx Sidebar inSettings 分支）；用户菜单四项接真实跳转。验收：每组读写落库/localStorage；Back 返回原页面。
- **N8-05 Capabilities 向导对账**：对照 wizards.jsx 逐个核对 M7 成果，缺则补：AddConnectorWizard（三方法分步）、ManageConnectorDrawer（scopes 开关/同步日志/重授权/断开）、ImportSkillWizard（选源→扫描→勾选导入）、ConfigureAgentDrawer（systemPrompt/模型/工具开关）、SkillDetailDrawer（manifest 预览/assign）、FindForMeModal（按重用度 top5）、统一 ConfirmDialog 删除确认（含"被 N 条 pipeline 使用"文案）。**先 grep 现状再开工，已有的不重写**。验收：每个向导走通一轮并落库。

### N9 · 拆旧与清理

- **N9-01** `pages/CanvasPage/` 整目录移 `archived/pages/CanvasPageLegacy/`；修复全部断 import（含 ComponentsPage/ComponentEditor、FolderBrowserDialog 测试等当前仍引用旧目录的文件——改指 `WorkspacePage/canvas/panels`）；删除路由引用。
- **N9-02** `bun run knip` 清零；AgentBar 旧卡片、JobsPage 旧组件、AnnComposer/AnnViewer、旧 RunConsole 等 i18n 死键清理（en+zh 同步）。
- **N9-03** 全量质量门 + 三路径回归截图存 pr-assets/。
- **验收**：全仓搜不到 `from "@/pages/CanvasPage"`（archived 除外）。

### N10 · 最终验收清单（合并前必过）

- [ ] 新建 → 手工搭建 → Run 跑通；打开旧 pipeline → 直接 Run；样本 → reversing → proposal → Apply → Run（三主路径）
- [ ] 点选节点/边/钻入子节点 → 芯片出现 → hover 高亮 → click 定位；Ask → 徽标 → 线程 → resolve 闭环
- [ ] proposal 虚线预览 + new/edited/reused 标签 → Apply 实体化 → 版本 Save as new
- [ ] 运行：状态灯/边流动/RunConsole/Checkpoint(含 Edit step)/Stop 取消语义/自愈折叠行/中断可点链接
- [ ] Jobs：List 四动作 + Review；Calendar 幽灵块随 Routine 增删；Pipelines Schedule 芯片全局同步
- [ ] 壳：拖拽布局/通知中心/全局搜索 7 组/Settings 六组/SignOut
- [ ] ContextStrip 各项随状态真实点亮；Memory summary 不再恒亮
- [ ] `canvas/` 无文件 >300 行；AgentBar messages 无文件 >120 行；knip 清零；en/zh 键完整
- [ ] 每个 N 任务有与原型并排的目检截图（pr-assets/）

---

## 五、给执行 agent 的特别警告

1. **禁止在旧 `pages/CanvasPage/` 目录内修改任何文件**——只允许"复制出来再改"。N9 之前旧目录原样冻结。
2. **phase 永远不能出现新的业务 `setPhase("xxx")` 调用**（DebugPhaseBar 除外）。`reversing`/`clarify` 是 AgentBar 局部临时态，不进全局 setter；想 set = derivePhase 缺规则，去补规则和单测。
3. **批注不准走 annotations 表的旧 UI 路径**——徽标/线程一律由 conversation_messages 驱动；发现自己在写 AnnViewer 类似物 = 方向错了。
4. **原型的演示装置不要搬**：walkthrough stepper、MacWindow、ScaledStage、关键词模板回复、Seed 按钮（DEV 除外）。阶段推进只能由真实对话流与运行事件驱动。
5. 每完成一个 N 任务：浏览器对照原型目检 → 截图存 pr-assets/ → `bun run format` → `bun run quality` → 单独 commit。视觉回归是上一轮返工的最大教训。
6. **新组件必须 useTranslation（en+zh 同步）+ story + data-testid**——这是硬性验收，不是建议。
