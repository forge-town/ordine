# Ordinctor 产品需求文档（PRD）

> v2 · 2026-06-11 · 本版按最新前端设计稿（Ordien 设计稿：`lib.jsx` / `workspace.jsx` / `jobs.jsx` 为最新迭代，`canvas.jsx` / `shell.jsx` / `panels.jsx` / `pages.jsx` / `wizards.jsx` / `settings.jsx` / `runtime.jsx` 沿用上一迭代）更新交互逻辑。
> 与 v1 的主要差异：①批注与对话合并为"选中即上下文"（Lovable 式）；②Agent Bar 改为极简无卡片风格并新增上下文透明条；③Jobs 升级为"机群控制台"（列表 + 周历双视图，Routine 全局共享）；④新增 Pipeline 版本管理、通知中心、Settings、全局搜索、可拖拽布局等应用壳能力。

## 1. 产品基本信息

| 项目 | 内容 |
|------|------|
| 产品名称 | Ordinctor |
| 产品定位 | 本地多 Agent 编排与工作流沉淀平台 |
| 一句话描述 | 用户说要做什么，Ordine 指挥用户电脑上的 AI Agent 把它做出来，做完自动存成一条可复用的 Pipeline，下次直接复用。 |

## 2. 目标用户

### 2.1 用户画像

- **重复性知识生产者**：已经在使用 Claude Code、Codex、本地脚本、MCP、Skill 等 AI 工具，但不知道如何把它们稳定串进日常工作流的人
- **高级 AI 用户**：有重复性代码生产、内容生产、调研分析、质量校验任务的个人用户和小团队
- **效率追求者**：希望"说出目标 → AI 规划流程 → 自动执行 → 下次复用"的用户

### 2.2 用户核心诉求

1. 降低 AI 工作流编排门槛——不需要手动画 DAG、不需要提前知道该用几个 Agent
2. 让一次性 AI 对话沉淀成可复用的 Pipeline 资产
3. 可视化掌控感——看到流程在做什么，而不是看黑盒 Agent 自己跑
4. 统一指挥本地已有 Agent，而不是替代 Agent

## 3. 产品愿景

Ordine 是一个"AI 编排指挥台"。用户只需描述目标或上传一个期望成品样本，Ordine 的 Agent Bar 会结合当前项目上下文、历史 Pipeline、运行日志和用户偏好，生成可执行的编排方案。方案在 Canvas 上可视化展示，用户可修改结构、点选任何节点或边让它进入对话上下文，再用自然语言要求 Agent 修改。执行完成后，Pipeline 自动沉淀为可复用资产。

核心闭环：**说 → 长 → 跑 → 存 → 复用**。

## 4. 为什么是编排（而非单 Agent）

### 4.1 编排真正赢、且不随模型变强而消失的地方

1. **复用 / 可重复（最硬）。** 单 Agent 对话是一次性的；编排把"方法"固化下来，换个输入就能第 N 次一模一样地跑。工厂不跟老师傅比"做第一件"，它赢在"稳定做第 1000 件"。
2. **异构执行（物理边界）。** 没有任何单 Agent 同时握有所有工具 / 凭证 / 环境。跨执行者连成链路是物理限制，模型再强也不消失。
3. **拆解即质量。** 生成 + 独立上下文的校验，能抓到"自己检查自己"系统性看不见的错。
4. **掌控 / 可观测 / 控成本。** 每步可见、可钉、可换、可只重跑某一节、可设花费上限。
5. **吞吐 / 并行。** 多条 Pipeline、多份输入同时跑。

### 4.2 诚实承认的边界

- 一次性、探索性、还没想清步骤的任务——单 Agent 的灵活性碾压僵硬的图。
- 能塞进一个上下文就搞定的任务——再包一层 Pipeline 是多余仪式。
- 模型越来越会自我拆解——编排的部分价值会被单 Agent 内化掉（最大威胁）。

### 4.3 产品定位结论

Ordine 不在"第一次把活干成"上跟单 Agent 比，而赢在**把第一次的成功变成可复用、可观测、可分享的资产（SOP）**。

**设计底线：让"一个节点 = 一次单 Agent 调用"成为地板。** 只有一道工序时，Pipeline 退化成单 Agent，体验不比单 Agent 差；只有当复用 / 质量 / 异构 / 并行真的能回报用户时，才加结构。

## 5. 核心产品概念

### 5.1 核心心智模型

> **Component（组件）→ 组合成 Pipeline → Job 记录 Pipeline 的一次运行。**

- **Component（组件 / 资产）**：可复用构件，像零件一样组合成 Pipeline。分四类：Input Objects、Operations、Output、Pipeline Skill。
- **Pipeline**：若干 Component 用语义边组合成的 DAG（产线）。跑通后可存为可复用资产，且**有版本**（见决策 7）。
- **Job**：记录单次 Pipeline 运行情况（工单），可暂停 / 恢复 / 停止 / 重跑。
- **Routine**：Pipeline 的常驻触发器（cron 定时或事件触发），是"未来的 Job"的来源。

### 5.2 工厂隐喻

产品的组织直接借用现实工厂管理方法论：

| 产品概念 | 工厂对应 |
|----------|----------|
| Project | 车间 / 项目 |
| Pipeline | 产线 / 工艺路线 |
| Operation | 工序 / 工位作业 |
| 语义边（Data Contract） | 在制品流转规格 / 物料接口 |
| Components（组件库） | 标准件库 + 工装夹具 |
| Pipeline Skill（固化 pipeline） | 标准作业 SOP |
| Local Agent / Skill / Connector | 工人 / 技能 / 外部工具 |
| Job | 工单 / 生产订单 |
| Routine | 排产计划 |
| Jobs 页（列表 + 周历） | 车间调度台 / 排产看板 |
| Agent Bar | 工艺工程师 + 线长 |
| 用户 | 厂长 |

### 5.3 三平面模型

概念按关注点切成三个平面——对应制造业的"工艺设计 / 资源 / 车间执行"分离：

- **Assembly（工艺设计 · 核心）**：设计与装配产线——Pipelines、Components。产品重心。
- **Monitor（车间执行）**：启动与监控——Jobs（含 Routines 与周历）、Usage。
- **Capabilities（资源 · 可插拔 · 次要）**：待装配的零件——Local Agents、Skills、Connectors。

## 6. 核心产品决策

### 决策 1：Pipeline 是唯一的一等编排单元

不做顶层模式切换。Verify、Council、Delegation 不再是平级模式，而是 Pipeline 内的复合节点（CompoundNode）——外面看是一个步骤，双击"钻进去"才看到内部结构。Schedule（Routine）是 Pipeline 的触发器属性。

用户心智模型始终是"从左到右一条 Pipeline"，复合节点把非线性结构折叠进黑盒，认知负荷最低。

### 决策 2：语义化的边（Data Contract 优先）

大多数编排工具的边只是"执行顺序"。Ordine 给边赋予语义——边定义 A 的输出中哪些字段、以什么格式、传给 B 的哪个输入。

价值：
- 点击一条边即可看到这条线上流的是什么数据（EdgeInspector 字段映射 + 逐字段开关）
- 执行出错时精确定位哪条边的数据不对
- 换一个节点实现，只要输出格式不变就不影响下游——真正的模块化

四种边语义分期推进：Data Contract（P0）→ 条件边 → 转换边 → 质量门。

### 决策 3：Canvas 为中心的布局

Canvas 全幅默认 + 收起式侧栏。Canvas 是产品核心资产，不被左右栏压缩。所有 Canvas 级 UI（面包屑药丸、Run 按钮、组件面板、缩放工具）一律**浮动在画布之上**，不占布局高度。视觉风格 = soft-docked panels（柔性嵌入），配色黑白灰 + 红绿状态色。Canvas 质感追求 Figma/FigJam 式的艺术优雅。

左侧导航栏与右侧 Agent Bar 均**可拖拽调宽、可收起**（侧栏 200–360px、拖到阈值以下自动收起，留边缘把手唤回；Agent Bar 300–520px，同规则）。Agent Bar 以浮动圆角面板形式悬于工作区右侧。

### 决策 4：左栏按三平面分组

- **Assembly**：Pipelines | Components
- **Monitor**：Jobs | Usage
- **Capabilities**（可折叠）：Local Agents | Skills | Connectors

一等实体是 Project 和 Pipeline，不是 Chat。没有独立的 Chat 列表。侧栏顶部为 Project 切换器 + New Pipeline 主按钮 + 全局搜索框；底部为用户区（Account / Keyboard / Appearance / Sign out 菜单，前三项跳 Settings 对应分组）。

### 决策 5：批注 = 锚定在节点上的对话（Select → Prompt，Lovable 式）★ v2 新增

**不再有独立的"批注便利贴"实体。** 用户与 Agent 协作的唯一主路径是：

1. **选中即上下文**：点选画布上的任何节点 / 边（含钻入复合节点内部后的子节点），它立即成为 Composer 上方的 @ 引用芯片；框选多节点可"Ask about selection"整组进入引用。引用是结构化对象（id / 类型 / 标签 / 种类 / 钻入路径），不是标题字符串。
2. **芯片 ↔ 画布双向联动**：悬停芯片高亮画布上的对应元素；点击芯片画布自动平移缩放定位（spotlight）。
3. **就地提问**：节点悬停操作栏的 "Ask" 弹出 mini-composer，提交即在 Agent Bar 主对话流里发出一条自动携带该节点引用的消息——与主对话同一条流，不是孤立数据。
4. **节点徽标 = 线程入口**：节点左上角徽标数 = 引用该节点且未 resolve 的消息数；点徽标 → Agent Bar 切换为该节点的线程视图（过滤出相关消息），每条消息可 ✓ resolve，全部 resolve 后徽标消失；"Show all" 退出线程回到全量对话。
5. **Agent 回写闭环**：Agent 针对某节点的回复同样携带该节点引用，徽标同步计数，形成节点级线程。

数据模型上批注就是 `conversation_messages` 中带 `referencedNodeIds` 的消息（+ resolved 标记），不再单独维护 annotations 实体的主路径。

### 决策 6：上下文透明（Context Strip）★ v2 新增

Composer 上方有一条可展开的 **Context** 条，实时展示本条消息将携带的上下文构成及其注入规则：Project info（always）、Pipeline snapshot（always）、Conversation thread（windowed）、Selection（when selected）、Canvas annotations（when present）、Run state / Node runtime（run-time priority，运行中置顶）、Memory summary（always · compressed）。运行中自动切换为"run + runtime 优先"。用户永远知道 Agent 看到了什么。

### 决策 7：Pipeline 版本管理 ★ v2 新增

画布顶部药丸内显示当前版本号（`v3 · draft · saved` / `unsaved` 脏标记）。保存时二选一：**Overwrite 当前版本**或 **Save as new version**；版本历史可回看。资产沉淀与复用引用具体版本。

### 决策 8：Jobs 是机群控制台（fleet console）★ v2 升级

Jobs 页定位为"操作并发工单的控制台"，**不展示逐步细节噪音**（how 在画布上看）：

- **List 视图**：表格列 = Job / Status / Started / Duration / Cost / Actions。按状态提供行内操作：running → Pause / Stop；paused → Resume / Stop；queued → Cancel；failed / completed / cancelled → Rerun；**waitingForUser → 醒目的 Review 按钮**（打开详情处理检查点）。顶部摘要一行：x running · x queued · x waiting on you · x failed today。
- **Calendar 视图（周历）**：过去的运行（实块）与未来 Routine 排期（虚线幽灵块）画在同一张周网格上；事件触发型 Routine 显示在顶部 live 条；当天有"now"红线；重叠事件自动分列。点实块开 Job 详情，点幽灵块直接编辑对应 Routine。
- **Routine 全局一份**：Pipelines 页卡片上的 Schedule 芯片与 Jobs 页的 New Routine / 周历读写**同一份 Routine 数据**，任何一处设置全局可见。Schedule 编辑器支持 Manual / Cron（预设 + 5 段表达式）/ On event 三种触发，含启停开关与删除。
- **Job 详情抽屉**：逐步骤运行时（状态、耗时、token / cost、彩色 trace 行），含 Pause / Resume / Stop / Re-run 控制与"Open pipeline on canvas"。

### 决策 9：应用壳完整化 ★ v2 新增

- **通知中心**：标题栏铃铛 + 未读数；运行完成 / 自愈 / 失败 / 连接器待授权 / 资产沉淀等事件可回看、可跳转、可一键已读 / 清空。toast 仅作即时提醒。
- **全局搜索**：侧栏搜索框检索 Pipelines / Nodes / Components / Jobs / Skills / Connectors / Agents，分组展示，点击直达。
- **Settings 独立页**：进入后侧栏变形为"← Back + 分组导航"。六组：General（语言 / 外观 / 启动页）、Defaults（默认 Agent / 模型 / API Key / 输出路径）、Project（名称 / 描述 / 归档）、Keyboard（快捷键速查）、Account（本地身份 / Sign out）、Advanced(数据目录 / 版本 / 清空对话 / 重置危险区)。
- **Sign out**：本地模式登出覆盖层，数据留在本机。

## 7. 功能概览

### 7.1 Pipeline 编排（P0）

- 用户描述目标 → Agent 生成 DAG → 用户确认 → 执行 → 自动沉淀为可复用资产
- Canvas 可视化编辑与执行监控（拖拽建节点、手柄连线、框选、复合、钻入、撤销重做、复制粘贴）
- Agent Bar 自然语言交互生成和修改 Pipeline

### 7.2 语义化的边（P0 - Data Contract）

- 边定义数据字段映射和格式；EdgeInspector 逐字段开关哪些数据流向下游
- 执行时按契约传递数据
- 资产复用时边的契约是节点间的接口

### 7.3 组件库与资产沉淀（P0）

- 每个节点/组件创建后保存进组件库；组件编辑复用 NodeConfig 面板（带"被 N 条 pipeline 引用"提示）
- Agent 生成 Pipeline 时优先复用已有组件（"Find for me" 按重用度推荐）
- Pipeline 跑通后自动沉淀为 Pipeline Skill

### 7.4 Agent Bar 协作（P0）

- **极简风格**：无卡片 chrome——助手消息是纯文本，进度用左边框列表，操作用行内按钮 / 下划线链接；头部仅一枚状态点 + "Agent" + 阶段副标题。
- 七个阶段：`empty / reversing / clarify / proposal / applied / running / done`（reversing = 逆向工程分析中）。
- 自然语言描述目标；Agent 用快捷选项芯片追问；proposal 以左边框节点列表 + Apply / Revise / Reject 呈现，画布同步预览（虚线 + new/edited/reused 标签）。
- 执行中：行内显示 job id · step x/y · 耗时 · 花费；ReAct 自愈折叠成一行可展开（不设独立 Console）；需要用户介入（如连接器缺 token）时给出**可点击**的修复链接并暂停等待。
- 错误翻译成人话；完成态一句话总结 + 资产沉淀链接。
- Composer：附件上传（逆向工程入口）、@ 引用芯片、Enter 发送、Context Strip。
- 对话按 pipeline 持久化，可清空。

### 7.5 节点锚定批注 / 线程（P0）

- 见决策 5：选中即上下文、Ask 就地提问、徽标线程、resolve 闭环。

### 7.6 Verify 复合节点（P1）

- 生成 + 校验循环，独立上下文对抗（Generator ↔ Critic + Pass gate + loop 边 ≤3 轮）
- 通过则输出结果 + 校验报告

### 7.7 逆向工程入口（P1）

- 上传成品样本（Composer 附件或 empty 态引导项）→ 进入 reversing 阶段（读结构 / 推步骤 / 匹配组件 / 起草 pipeline 四步进度）→ 产出 proposal

### 7.8 Routine 触发器与排产周历（P1→P2 分两步）

- P1：Routine CRUD + Schedule 编辑器 + Pipelines/Jobs 全局共享 + 周历视图（读）
- P2：后台常驻调度可靠性（错过补跑、并发上限）

### 7.9 Council / Delegation 复合节点（P3）

- Council：Moderator 分发 → 多角色辩论 → Converge 收敛（loop 边再来一轮）
- Delegation：Split → 隔离并行 Worker → Merge

## 8. 用户旅程

### 8.1 首次使用（从零到跑通）

1. 用户新建 Project → 进入工作空间
2. 点 New Pipeline → 空 Canvas + Agent Bar empty 态（建议项：描述目标 / 上传样本逆向）
3. 在 Agent Bar 描述目标（或上传成品样本 → reversing 分析）
4. Agent 用选项芯片追问关键信息（clarify）
5. Agent 生成 proposal → Canvas 虚线预览（new/edited/reused 标记）→ Agent Bar 列出节点清单
6. 用户 Apply（或 Revise 后再 Apply）→ 节点实体化（applied）→ 点击 Run
7. Canvas 切换执行态：节点状态灯 + 边流动动画 + Run console 流式日志；检查点弹卡（Approve / Edit step / Stop）
8. 执行完成 → 输出产物 → 自动沉淀为 Pipeline Skill，Agent Bar 给出打开链接

### 8.2 复用已有 Pipeline

1. 从 Assembly > Pipelines 选择一条已有 Pipeline（卡片含步骤链缩略、运行统计、Schedule 芯片）
2. Canvas 加载结构（applied 态，Run 直接可用），Agent Bar 显示历史对话
3. 替换输入节点配置或直接对 Agent 说"换成这个文件夹"
4. 点击 Run → 执行 → 产出；如需定期跑，在卡片 Schedule 芯片或 Jobs 页配置 Routine

### 8.3 精修某个节点（Select → Prompt）

1. 点选节点（或框选一组节点 → Ask about selection）→ Composer 出现 @ 芯片
2. 输入"把干扰项做得更难" → 消息携带结构化引用发出
3. Agent 修改该节点（画布预览），回复同样锚定节点 → 节点徽标 +1
4. 点徽标进入该节点线程回看；处理完 ✓ resolve，徽标消失

### 8.4 执行中出错

1. 节点报错 → Canvas 红灯 + 边停流；Job 状态同步
2. Agent Bar 行内自愈（折叠展示尝试过程：换参数重试等）
3. 自愈成功 → 继续执行；需要用户时（如 Notion 未授权）→ 人话说明 + 可点击的 "Connect Notion" 链接，Job 转 paused/waiting
4. 用户修复后 Agent 接续；用户也可随时 Pause / Stop / Rerun（Jobs 页或详情抽屉）

### 8.5 监控机群（多 Job 并发）

1. 进 Monitor > Jobs：摘要行 + 列表，运行中的行内 Pause/Stop，等待签核的亮 Review
2. 切 Calendar 看本周：过去跑了什么、未来 Routine 何时跑，一屏排产
3. 点任意 Job 开详情抽屉看逐步 trace 与花费；需要进画布时一键 "Open pipeline on canvas"

## 9. 全局交互原则

1. **先 proposal，后执行**：Agent 生成的 Pipeline 首次执行前必须经用户确认。
2. **默认不打扰**：可自动恢复的问题自动处理；只在敏感操作/意图歧义/连续自愈失败时请求用户许可。
3. **用户随时可接管**：暂停、修改未执行节点、重跑某节点、停止运行、保存当前状态（含另存新版本）。
4. **Canvas 与 Agent Bar 共享状态**：选中、引用、徽标、阶段、运行状态——任何区域变化，其他区域同步（双向联动是硬要求）。
5. **错误必须翻译成人话**：固定格式"哪里出了问题 → 为什么 → 建议怎么处理"，且"怎么处理"必须是可点击的动作而非纯文本。
6. **上下文透明**：用户随时可查看本条消息携带了什么上下文、为何携带（Context Strip）。
7. **修改即留痕**：图结构编辑可撤销重做；保存有版本；事件有通知历史。

## 10. 成功标准

### 10.1 核心闭环

- 用户能走通"说 → 长 → 跑 → 存 → 复用"完整闭环
- Pipeline 资产被实际复用（复用率 > 0）
- 用户不需要理解 DAG 就能开始

### 10.2 体验标准

- 用户不需要切换"编排模式"就能获得校验/多角色/拆分能力
- 运行时用户知道当前系统在做什么；多条并发时一页可调度
- 出错时用户能看懂原因和下一步，且下一步可点击
- 跑通后用户能感知"Pipeline 资产"被沉淀
- 对某个节点的讨论能沉淀为该节点的线程，可回看可关闭

## 11. 优先级

| 优先级 | Feature | 理由 |
|--------|---------|------|
| **P0** | Pipeline 编辑 + 执行 + 资产沉淀 | 核心差异化，产品立身之本 |
| **P0** | 语义化的边（Data Contract） | 底层数据模型代差 |
| **P0** | Workspace Shell + Agent Bar（极简版）+ Canvas 全幅浮动 chrome | 终局界面骨架 |
| **P0** | Select → Prompt（选中即上下文 + 节点线程） | 用户与 Agent 协作的主路径 |
| **P0** | Connector 可视化管理 | 后续编排依赖 |
| **P1** | 逆向工程入口（附件 + reversing 阶段） | 最强获客钩子 |
| **P1** | Verify 复合节点 | 质量保障结构性优势 |
| **P1** | 完整执行状态机 + 暂停/检查点/恢复 + Job 控制（Pause/Stop/Rerun） | 可视化掌控感 |
| **P1** | Jobs 控制台（List + Calendar）+ Routine 共享 | 多 Job 并发后的刚需 |
| **P1** | Pipeline 版本管理 | 资产可靠性 |
| **P1** | 通知中心 + 全局搜索 + Settings | 应用壳完整性，"坏掉的按钮"清零 |
| **P2** | Routine 后台可靠调度 | 复用价值高但非核心差异 |
| **P2** | 条件边 / 转换边 / 质量门 | 语义化边后续期 |
| **P3** | Council / Delegation 复合节点 | 等用户反馈后决定 |
| **P3** | Pipeline 共享 / 社区 | 网络效应，非 V1 |

## 12. 非目标（第一阶段）

- 多人实时协作 / CRDT 协同编辑
- 完整热修改正在执行的节点
- Routine 后台可靠调度（错过补跑等，P2）
- 条件边/转换边/质量门一次性全部完成
- Council / Delegation 复合节点一次性完成
- 自研 Canvas 引擎
- 替代 Claude Code / Codex 等 Agent
- 深色主题完整落地（设计稿仅预留入口，标注 preview）

## 13. 竞品差异

与 n8n / LangGraph / Dify 的核心区别：
- **语义化的边**（数据契约）——不只是执行顺序，而是编排知识载体
- **资产沉淀**——一次性对话变成可复用 Pipeline（且带版本）
- **本地 Agent 编排**——不替代 Agent，统一指挥已有 Agent
- **复合节点封装复杂模式**——不做顶层模式切换，认知负荷低
- **Select → Prompt 协作**——画布元素即对话上下文，批注即对话

与 Multica 的核心区别：
- Multica 把 Agent 当主角；Ordine 把组件和 Pipeline 当主角，Agent 只是可替换的执行层
