# COD-355 前端体验迁移合同（Alan 基准）ADR

> 状态：COD-355 实施与作用域验收已收口；Canvas/Agent/RunConsole、五视口、Web/Desktop 共享、Storybook 构建、页面 acceptance Playwright 与 fresh visual evidence 已完成。固定 Alan SHA 原始迁移目录缺少当前运行时所需的 routines 兼容列；本轮用不改 Alan 源码的临时 PGlite/migration harness 完成 9440 对照。Alan Storybook manager 可列出 stories，但 preview iframe 仍为空白/loading，见 §36；仓库级 app lint 与 Desktop 直接 tsc 仍保留任务前即可复现的历史基线失败，本文不据此宣称仓库所有历史质量门全绿
> 关联票：COD-355 · 关联：COD-329 / COD-333 / COD-316（历史）· COD-354（活动架构）
> 分支：`issue-355-alan-ui-migration`

---

## 1. 决策

以 `Alan-Youngzhe/Ordine-fork` 仓库 `develop-fork` 分支的固定提交为**体验规范基准**，以当前 `upstream/develop` 为**业务/架构规范基准**，系统迁移当前 develop 前端，使其在保留全部新功能、数据能力与运行时能力的前提下，恢复 Alan 版本清晰、稳定、直觉一致的产品体验。

本任务**不是**整分支覆盖，**不是**直接 cherry-pick；禁止为追求外观还原而恢复已废弃实体、旧 API 或旧状态模型。

## 2. 冻结基线

| 角色     | 权威来源                                     | 分支                           | 固定引用                                   | 时间                         |
| -------- | -------------------------------------------- | ------------------------------ | ------------------------------------------ | ---------------------------- |
| 体验基准 | https://github.com/Alan-Youngzhe/Ordine-fork | `develop-fork`（仓库默认分支） | `c3cf683f231b0021473cb6621f9d619402831bfb` | 2026-06-21                   |
| 业务基准 | https://github.com/forge-town/ordine         | `develop`                      | `5771dce1b4ab0e60af6af2bd5da3a67f905c86cf` | 2026-08-13（任务开始时最新） |

**远端校验（2026-08-14 现场确认）：**

```
GitHub HEAD (refs/heads/develop-fork):  c3cf683f231b0021473cb6621f9d619402831bfb
本地跟踪 alan-fork/develop-fork:         c3cf683f231b0021473cb6621f9d619402831bfb
固定参考提交:                              c3cf683f231b0021473cb6621f9d619402831bfb
三者一致 → PASS
```

本地映射：

```bash
git remote add alan-fork https://github.com/Alan-Youngzhe/Ordine-fork.git
git fetch alan-fork develop-fork
# 若远端未来消失，不可变恢复引用：
# git cat-file -p c3cf683f231b0021473cb6621f9d619402831bfb
```

**固定引用恢复说明**：固定 SHA 已通过本地对象库与远端双重记录；若远端 `develop-fork` 未来被 force-push 或删除，以本 ADR 中的 SHA 为准，通过 `git fetch alan-fork <sha>` 仍可恢复（git 允许按 SHA 直接取回对象）。

## 3. 目录映射

| Alan（apps/app/src）                        | 当前（共享包）                                                               | 说明                               |
| ------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| `pages/<X>`                                 | `packages/views/src/pages/<X>`                                               | 页面迁移到共享层，Web/Desktop 复用 |
| `components/AppSidebar/`                    | `packages/views/src/components/AppSidebar.tsx` + `NavGroup.tsx`              | 侧栏                               |
| `components/AppLayout.tsx`                  | `packages/views/src/components/AppLayout.tsx`                                | 全局壳层                           |
| `components/AppSidebar/ProjectSwitcher.tsx` | `packages/views/src/components/ProjectSwitcher.tsx`                          | 项目切换器                         |
| `components/AppSidebar/NavGroup.tsx`        | `packages/views/src/components/NavGroup.tsx`                                 | 导航分组                           |
| `components/AppSidebar/UserFooter.tsx`      | 并入 `ProjectSwitcher.tsx`                                                   | 用户脚注                           |
| `components/primitives/`                    | `packages/views/src/components/primitives/`                                  | 共享 primitive                     |
| `store/themeStore/`                         | `packages/views/src/store/themeStore/`                                       | 主题 store（当前为 context 版）    |
| `store/sidebarStore/`                       | `packages/views/src/store/sidebarStore/`                                     | 侧栏 store                         |
| `store/toastStore/`                         | `packages/views/src/store/toastStore/`                                       | Toast store                        |
| `store/notificationStore/`                  | `packages/views/src/store/notificationStore/`                                | 通知 store                         |
| `store/autonomyStore/`                      | `packages/views/src/store/autonomyStore/`                                    | 自治 store（当前新增）             |
| `pages/WorkspacePage/`                      | `packages/views/src/pages/CanvasPage/`                                       | 画布（重构后的承接）               |
| `styles.css`                                | `apps/app/src/styles.css` + `packages/views/src/pages/CanvasPage/canvas.css` | 样式（大量动画类缺失，见 §6）      |
| `locales/en.json / zh.json`                 | `apps/app/src/locales/` + `apps/desktop-app/src/locales/`                    | i18n（当前键量 2.7x）              |

## 4. 路由对照矩阵

当前路由以 `apps/app/src/routes/_layout/*.tsx` 为准；Desktop 用独立 routeTree，但页面组件引用共享 `packages/views`。Alan 仅有 `apps/app` 一份路由。

| 表面（Route）       | Alan（apps/app）                                         | 当前（apps/app + views）                                           | 迁移策略                                            |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| 首页 / 创建入口     | `_layout/index.tsx` → redirect `/pipelines`              | `_layout/index.tsx` → `HomePage`（首条消息直达三栏工作区 COD-345） | **由当前等价实现承接**（COD-345 新功能，保留）      |
| Pipelines 列表      | `pipelines.index.tsx`                                    | `_layout/pipelines.index.tsx`                                      | **适配后复用**（布局与筛选密度已承接）              |
| Pipeline 详情/画布  | `workspace.$pipelineId.tsx`                              | `canvas.tsx` → `CanvasPage`                                        | **适配后复用**（结构重构）                          |
| Jobs 列表           | `jobs.index.tsx`（顶层）                                 | `_layout/pipelines.jobs.index.tsx`（归入 pipelines）               | **适配后复用**（路由层级变更，行为承接）            |
| Job 详情            | `pipelines.jobs.$jobId.tsx`                              | `_layout/pipelines.jobs.$jobId.tsx`                                | **适配后复用**（详情层级与 develop 日志能力承接）   |
| Components          | `_layout/components.tsx`                                 | `_layout/components.tsx`                                           | **适配后复用**（共享页面布局）                      |
| Operations          | `_layout/pipelines.operations.*`                         | `_layout/pipelines.operations.*`（新增 new/edit 子页）             | **由当前等价实现承接**（更细粒度路由）              |
| Objects             | 无（Alan 期无此功能）                                    | `_layout/pipelines.objects.*`                                      | **当前承接**（保留 develop 对象目录与插件对象详情） |
| Connectors          | `_layout/connectors.tsx`                                 | `_layout/connectors.tsx`                                           | **适配后复用**（卡片/筛选密度承接）                 |
| Agents              | `_layout/agents.index.tsx` / `agents.$agentId.index.tsx` | 同结构                                                             | **当前承接**（保留 develop Agent 表单）             |
| Local Agents        | `_layout/local-agents.tsx`                               | `_layout/local-agents.tsx`                                         | **当前承接**（保留 develop 本机扫描/同步）          |
| Runtimes            | 无（Alan 期无）                                          | `_layout/runtimes.*`                                               | **当前承接**（保留 develop 扫描、详情和编辑）       |
| Skills              | `_layout/skills.tsx`                                     | `_layout/skills.tsx`                                               | **适配后复用**（筛选/卡片/导入入口承接）            |
| Plugins             | `_layout/plugins.tsx`                                    | `_layout/plugins.tsx`                                              | **当前承接**（保留插件对象类型能力）                |
| Usage               | `_layout/usage.tsx`                                      | `_layout/usage.tsx`                                                | **当前承接**（保留 Token/运行时统计）               |
| Distillations       | 无独立路由（desktop 有）                                 | `_layout/distillations.*`（新增列表/详情/新建）                    | **当前承接**（保留 develop 蒸馏工作流）             |
| Distillation Studio | 无                                                       | `_layout/distillation-studio.tsx`                                  | **当前承接**（保留 develop Studio 表单）            |
| Settings            | `_layout/settings.tsx`                                   | `_layout/settings.tsx`                                             | **适配后复用**（分组导航与响应式承接）              |
| Assistant           | 无                                                       | `_layout/assistant.tsx`                                            | **当前承接**（保留 develop 当前路由）               |
| Login               | `login.tsx`                                              | `login.tsx`                                                        | **当前承接**（保留 develop AuthShell/登录能力）     |
| Sign-up             | `sign-up.tsx`                                            | `sign-up.tsx`                                                      | **当前承接**（保留 develop AuthShell/注册能力）     |
| 404                 | `-NotFound.tsx`                                          | `-NotFound.tsx`                                                    | **当前承接**（空白页级错误态保留）                  |
| API routes          | `api/*`（auth/local-session/trpc）                       | `api/*`（+operations/pipelines/pipeline-agent-sessions）           | **由当前等价实现承接**                              |

### Alan 有而当前无的路由

| Alan 路由                   | 当前状态                             | 结论                                            |
| --------------------------- | ------------------------------------ | ----------------------------------------------- |
| `jobs.index.tsx`（顶层）    | 已并入 `pipelines.jobs.index.tsx`    | **适配后复用**（信息架构归位到 Pipelines 分组） |
| `workspace.$pipelineId.tsx` | 已重构为 `canvas.tsx` + `CanvasPage` | **适配后复用**                                  |

### 当前有而 Alan 无的路由（保留 develop 当前承接）

`assistant`、`distillations*`、`distillation-studio`、`runtimes*`、`pipelines.objects*`、`agents.$agentId.index`。

这些路由没有 Alan 页面基准，但继续使用 develop 的路由、Store、API、Schema 和运行时能力；迁移结论记录为“当前承接”，不删除、不恢复旧实体，也不把缺少 Alan 对应页误记为“不适用”。

## 5. 页面/组件迁移矩阵（v2，源码与浏览器证据版）

> 状态枚举：**直接复用** / **适配后复用** / **当前承接** / **不适用**。
> 本矩阵以双方固定源码基线为起点，并由 §13–§34 的单测、Storybook、真实浏览器和 Playwright 证据持续更新；禁止以"风格参考"替代交互证据。

### 5.1 全局壳层

| Alan 表面                                                                         | 当前对应                                             | 结论       | 证据/说明                                                                                                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AppLayout（含侧栏宽度记忆、折叠）                                                 | `packages/views/src/components/AppLayout.tsx`        | 适配后复用 | shared 壳层恢复 COD-124 的 `SidebarProvider widthStorageKey`；Web wrapper 继续保留 develop 的宽度范围，`SidebarRail` 的折叠和记忆能力不变，证据见 §38。 |
| AppSidebar（NavGroup 分组、徽标、搜索、折叠）                                     | `AppSidebar.tsx` + `NavGroup.tsx`                    | 适配后复用 | 以 `5cfcd232` 的已提交壳层恢复品牌行、项目切换器、搜索/新建入口和折叠对齐，同时保留 develop 新导航，证据见 §38。                                        |
| ProjectSwitcher                                                                   | `ProjectSwitcher.tsx`                                | 适配后复用 | 恢复 COD-124 的 `FolderKanban`/项目按钮/`py-2` 壳层；项目查询、切换、创建逻辑继续使用 develop。                                                         |
| NotificationCenter                                                                | `NotificationCenter.tsx`                             | 适配后复用 | 当前存在，结构近                                                                                                                                        |
| SearchPipelineDialog                                                              | `SearchPipelineDialog.tsx`                           | 适配后复用 | Alan 式宽度、空态、结果分组、图标方块与状态 Tag 已承接；当前仍只搜索 develop Pipeline 资源并导航 `/canvas?id=...`，证据见 §25。                         |
| NewPipelineDialog                                                                 | `NewPipelineDialog.tsx`                              | 当前承接   | 当前使用 develop `PipelineCreationWorkspace`，保留生成/预览/运行/创建 another 业务，不恢复 Alan 旧状态。                                                |
| ToastContainer / toastStore                                                       | `ToastContainer.tsx` / `toastStore`                  | 当前承接   | —                                                                                                                                                       |
| ThemeStore（dark/light/system）                                                   | `themeStore`（context 版）                           | 当前承接   | 当前默认 `system`，Alan 默认 `light`；语义等价                                                                                                          |
| PageLoadingState                                                                  | `PageLoadingState.tsx`                               | 当前承接   | 现有 list/detail/grid stories 与页面 loading 语义继续复用。                                                                                             |
| PageHeader                                                                        | `PageHeader.tsx`                                     | 适配后复用 | 当前共享 header 保留 Alan 的标题/返回/动作层级，并额外承接 develop eyebrow/sub/badge。                                                                  |
| primitives（Chip/Dot/Icon/MiniChain/Mono/SearchInput/Stat/StatusPill/Tag/BarRow） | 同清单在 `packages/views/src/components/primitives/` | 直接复用   | 文件名一一对应，已落共享层                                                                                                                              |

### 5.2 页面（Alan → 当前）

| Alan 页面                           | 当前对应                                                                  | 结论       | 证据/说明                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PipelinesPage                       | `PipelinesPage`                                                           | 适配后复用 | 筛选计数、右侧搜索、圆角空态和卡片密度已承接，证据见 §18。                                                                                        |
| PipelineDetailPage                  | `PipelineDetailPage`                                                      | 适配后复用 | 当前 develop 详情保留 Canvas 预览、运行面板、节点列表和蒸馏入口，页面层级与 Alan 对齐；证据见 §30。                                               |
| WorkspacePage（画布）               | `CanvasPage`                                                              | 适配后复用 | 结构大改：Alan `canvas/`（CanvasRoot/flow/nodes/chrome）→ 当前扁平 `CanvasPage/*`（30+ 子组件），节点/面板拆分更细。体验语义需逐一对照（见 §6.2） |
| JobsPage                            | `JobsPage`                                                                | 适配后复用 | Alan 式无厚边框工具栏、右对齐筛选、圆角空态和排程选择器已承接；列表/日历/Routine/Job 控制保持 develop，证据见 §26。                               |
| JobDetailPage                       | `JobDetailPage`                                                           | 适配后复用 | 当前 develop 详情保留 Job 状态、Agent Runs、日志、蒸馏和路由行为，页面层级与 Alan 对齐；证据见 §30。                                              |
| ComponentsPage                      | `ComponentsPage`                                                          | 适配后复用 | Alan 式分类密度、网格和空态已承接，develop 内置项/Operation/资产/推荐能力保持，证据见 §27。                                                       |
| OperationsPage                      | `OperationsPage`                                                          | 适配后复用 | Alan 式轻量工具栏、Grid/List 和空态已承接，develop 导入/排序/创建保持，证据见 §28。                                                               |
| OperationCreatePage / Edit / Detail | `OperationCreatePage` / `OperationEditPage` / `OperationDetailPage`       | 适配后复用 | 表单、脚本/Agent 动态分支、数据契约和摘要区已在真实浏览器验证，证据见 §33。                                                                       |
| ConnectorsPage                      | `ConnectorsPage`                                                          | 适配后复用 | 共享壳层、筛选 chip、MCP 卡片、测试/管理动作已验证，见 §32。                                                                                      |
| AgentsPage / AgentDetailPage        | `AgentsPage` / `AgentDetailPage`                                          | 当前承接   | 空态、搜索、创建 Agent 表单继续使用 develop 资源和 Store，见 §37。                                                                                |
| LocalAgentsPage                     | `LocalAgentsPage`                                                         | 当前承接   | 保留本机扫描、同步和配置运行时能力，见 §32。                                                                                                      |
| SkillsPage                          | `SkillsPage`                                                              | 适配后复用 | 分类筛选、搜索、导入预览、卡片和 Operation 入口已验证，见 §32。                                                                                   |
| PluginsPage                         | `PluginsPage`                                                             | 当前承接   | 插件版本与对象类型展示继续使用 develop 数据，见 §32。                                                                                             |
| UsagePage                           | `UsagePage`                                                               | 当前承接   | Token 趋势、Pipeline/Agent 统计和空数据文案继续使用 develop 查询，见 §32。                                                                        |
| SettingsPage                        | `SettingsPage`                                                            | 适配后复用 | Alan 式窄内容列与分组导航已承接；develop 设置 section、Store、语言/主题/键盘帮助保持。证据见 §29。                                                |
| LoginPage / SignUpPage              | `LoginPage` / `SignUpPage`                                                | 当前承接   | develop AuthShell、OAuth/邮箱表单和本地化文案保留；本地模式会自动登录，未伪造匿名浏览器截图。                                                     |
| （无）                              | `DashboardPage`                                                           | 当前承接   | develop 当前首页/仪表盘能力保留，不复制 Alan 旧实体                                                                                               |
| （无）                              | `ObjectsPage` / `ObjectTypeDetailPage`                                    | 当前承接   | develop 对象类型目录与插件对象详情保留；本轮真实证据见 §37                                                                                        |
| （无）                              | `RuntimesPage` / `RuntimeDetailPage` / `RuntimeEditPage`                  | 当前承接   | develop 本机扫描、运行时详情和编辑能力保留；本轮真实证据见 §37                                                                                    |
| （无）                              | `DistillationsPage` / `DistillationDetailPage` / `DistillationStudioPage` | 当前承接   | develop 蒸馏草稿、结果、刷新恢复和删除能力保留；本轮真实证据见 §37                                                                                |

### 5.3 Agent / Canvas 交互子表面

| Alan 子表面                                                                                                                     | 当前对应                                                                                | 结论       | 证据/说明                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AgentBar（`WorkspacePage/AgentBar/`）                                                                                           | AgentPanel（`CanvasPage/AgentPanel/`）                                                  | 适配后复用 | Alan header/body/footer、空态建议、Composer/ContextStrip/RefChips 与 Proposal/message 语法已承接；runtime/session/upload/streaming/diagnostics/proposal actions 继续使用 develop。                                                                  |
| canvas/chrome（CanvasToolbar/ComponentPanel/StateLegend/TopPill/VersionMenu）                                                   | CanvasToolbar/CanvasComponentPanel/CanvasTopChrome/CanvasStatusBar/CanvasMiniSidebar 等 | 适配后复用 | `ComponentPanel.tsx`、`TopPill.tsx`、`CanvasToolbar.tsx` 的 JSX/class 已直接移植；面板开关、创建/拖拽、标题、保存、设置、运行和 Agent 动作全部继续调用 develop Store/API。                                                                          |
| canvas/flow（CanvasFlow/SemanticEdge）                                                                                          | CanvasFlow + SemanticEdge                                                               | 适配后复用 | 所有 routed edge 已注册为稳定 `semantic` 类型；选中、proposal、运行完成/流动、condition 和 qualityGate 仅读取 develop `selectedEdgeId`、`agentPanel.pendingProposal`、`nodeRunStatuses` 与 `PipelineEdgeData`。                                     |
| canvas/nodes（OperationNode/PromptNode/CompoundNode/FileNode/FolderNode/GithubProjectNode/OutputNode/GNodeShell/NodeCardPorts） | 同清单 + 新增 ErrorNode/CodeFileNode/OutputLocalPathNode/OutputProjectPathNode          | 适配后复用 | Alan `GNodeShell` 的 214px wrapper、原生 card、header/body/status、hover action pill 与 12px ports 已直接移植；develop 节点继续使用当前字段、focus/Agent/duplicate/remove 和 port mask/count。Compound 保留 parent/child 容器语义，仅承接中性视觉。 |
| canvas/panels（EdgeInspector/NodeConfig 各 section）                                                                            | CanvasEdgeInspector + CanvasNodePropertiesPanel + ConnectionMenu + CanvasSettingsDrawer | 适配后复用 | Alan 420px EdgeInspector 与 440px NodeConfig modal 已承接；mapping/condition/transform/qualityGate/节点字段只调用 develop actions，未引入 Alan delete/history/persist 状态。                                                                        |
| canvas/run（RunConsole/CheckpointDialog/useRunPolling）                                                                         | RunConsole/CheckpointCard/useCanvasWorkspacePersistence                                 | 适配后复用 | Alan 浮动 console shell/mono log 已承接；Job 轮询、trace parser、节点状态、timeline、multi-input、artifact、刷新和错误处理保持 develop。                                                                                                            |
| canvas/ask（AskComposer）                                                                                                       | AgentPanel Composer                                                                     | 适配后复用 | Alan composer 外观接到 develop runtime/session/upload/message 协议；没有恢复 Alan workspace Store。                                                                                                                                                 |

## 6. 样式资产差异（静态证据）

### 6.1 全局 token

双方 `styles.css` 的 `@theme inline` 与 `:root` token 集**基本一致**（radius、shadow、surface/canvas/edge 系、font 均相同）。逐 token 静态对比仅 2 个差异（`--xy-node-border`、`--xy-node-boxshadow-selected`，且已在当前 `CanvasPage/canvas.css` 内定义）。真实差异集中在**自定义 CSS 类与动画**：

| 差异               | Alan             | 当前                                  |
| ------------------ | ---------------- | ------------------------------------- |
| styles.css 行数    | 597              | 241                                   |
| 自定义 CSS 类/动画 | 约 50 个（见下） | 仅 canvas.css 保留约 10 个            |
| token 集           | 完整             | 等价（`--xy-node-*` 移到 canvas.css） |

Alan 有而当前缺失的样式类（静态枚举，须逐项决定承接/删除）：

```
.canvas-grid / .canvas-board-grid / .edge-path(.is-active/.is-pending)
.status-wash-success / .status-wash-error / .status-wash-muted
.node-running / .node-appear / .node-pulse / .canvas-node-pop
.edge-flow / .dash-flow / .spin / .ping / .fade-rise / .page-swap
.slide-in / .drawer-in / .bar-grow / .cfg-pop / .node-config-card
.edge-inspector-card / .cfg-range / .io-handle / .no-bar
.canvas-component-drag-image（含 icon/text/meta）
@media (prefers-reduced-motion: reduce)
```

### 6.2 Canvas 专用样式

当前 `packages/views/src/pages/CanvasPage/canvas.css` 已扩展到 346 行，承接 React Flow 节点基础样式、网格、连线状态、节点运行反馈、面板进入动效和 reduced-motion 降级；仍保留 develop 的 Canvas 状态与交互实现。

## 7. 双版本启动与截图流程（固定）

### 7.1 端口分配

| 版本                   | App  | Server | 登录模式                 |
| ---------------------- | ---- | ------ | ------------------------ |
| Alan（固定 SHA）       | 9440 | 9443   | `ORDINE_LOCAL_MODE=true` |
| 当前 develop（迁移前） | 9430 | 9433   | `ORDINE_LOCAL_MODE=true` |

### 7.2 Alan 版本启动

```bash
# 1) 检出固定 SHA 到隔离目录（不可变引用）
git fetch alan-fork c3cf683f231b0021473cb6621f9d619402831bfb
git worktree add /tmp/ordine-alan c3cf683f231b0021473cb6621f9d619402831bfb

# 2) 用环境变量覆盖端口启动（Alan 的 dev 脚本硬编码 9430，需 PORT 覆盖）
#    Alan 期 vite.config 未读 PORT env，须临时改 --port（仅截图验证环境，不入库）
cd /tmp/ordine-alan/apps/app && PORT=9440 bun run dev
cd /tmp/ordine-alan/apps/server && PORT=9443 ORDINE_LOCAL_MODE=true bun run dev
# 访问 http://localhost:9440
```

### 7.3 当前版本启动

```bash
cd .worktrees/cod-355-alan-migration/apps/app
ORDINE_LOCAL_MODE=true \
PGLITE_DATA_DIR=.runtime/pglite \
PGLITE_MIGRATIONS_DIR=../create/migrations \
BETTER_AUTH_SECRET=<local-only-secret-at-least-32-chars> \
bunx vite --host 0.0.0.0 --port 9430
# App http://localhost:9430; local-session is created by /api/local-session
```

### 7.4 截图约束

- 目标视口：`1440×900`、`1180×820`、`981×820`、`701×820`、`390×844`
- 同路由、同数据种子、同语言（默认 en）、同主题（light）、同滚动位置
- 动态区域（时间、光标、流式文本）先 mask 再比较
- 四联证据：Alan / Before / After / Diff（存 `pr-assets/`）

## 8. 实施拆分（按可独立验收表面）

| Phase | 表面                                                                                                                  | PR 建议    |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1     | 设计基础 + 全局壳层（token 补全、AppLayout 拖拽调宽、侧栏/顶栏/搜索/通知）                                            | 1–2 个 PR  |
| 2     | 首页→Canvas 上下文传递；Canvas 核心视觉/交互；Agent Panel/Composer/Proposal；Run Console 视觉表达                     | 3–5 个 PR  |
| 3     | Pipelines/Components/Operations/Objects；Jobs/Usage/Distillations；Connectors/Agents/Runtimes/Skills/Plugins/Settings | 按页面组拆 |
| 4     | Web/Desktop 共享；响应式断点；亮暗/中英；键盘/焦点/Reduced Motion                                                     | 1–2 个 PR  |
| 5     | 删除被替换的重复实现；视觉回归/E2E/构建/Storybook；证据矩阵收口                                                       | 收尾 PR    |

## 9. 验收标准（冻结）

1. Alan 权威仓库、`develop-fork` 分支与固定 SHA 已写入本 ADR 与测试说明。
2. 当前 develop 基线 SHA 已记录（§2）。
3. Route × Component × State × Interaction 迁移矩阵覆盖率 100%；每项均有四选一结论。
4. 所有"不适用"项有具体可验证原因。
5. 全局壳层与核心导航达到 Alan 信息层级与交互质量。
6. 首页选择的 Agent、Runtime、用户消息完整进入 Canvas。
7. Canvas 编辑交互与 Alan 等价或更优。
8. Proposal 应用有成功/失败/重试/冲突反馈。
9. Agent 活动、流式内容、无输出、心跳、错误状态清晰可见。
10. 刷新后运行状态与时间线可恢复，不回退为误导性"待运行"。
11. 运行产物在节点/Run Console/统一入口可发现。
12. Alan 之后新增功能全部可用；Web/Desktop 共享实现无平行复制。
13. 不引入旧 API/旧实体/第二套状态机；不遗留无调用 legacy 组件。
14. 亮暗、中英通过；五视口无遮挡/溢出/不可操作。
15. 键盘导航、焦点环、语义标签、Reduced Motion 通过。
16. 关键组件具备 Storybook 全状态矩阵；关键路径有 Playwright 回归。
17. 受影响包 typecheck/lint/build/定向测试通过。
18. PR 附 Alan/Before/After/Diff 证据与运行命令。
19. 产品负责人确认矩阵，Alan 完成体验复核。

## 10. 非目标

- 不重写后端或数据模型；不直接替换整个 develop；不整体 cherry-pick Alan。
- 不回退 Alan 之后新增功能；不将全部工作塞入一个超大 PR。
- 不以静态截图冒充交互完成；不以"视觉接近"替代逐项迁移与证据。

## 11. 风险与缓解

| 风险                  | 缓解                                                   |
| --------------------- | ------------------------------------------------------ |
| 历史依赖过旧          | 只迁移体验语义与可维护代码，依赖按当前栈替换           |
| 当前功能被覆盖        | 当前 API/Store/Schema 为不可回退基线，关键流必须有 E2E |
| 范围失控              | Phase 0 冻结矩阵后按表面拆票/PR                        |
| 重复组件增加          | 每个迁移 PR 说明替换关系，同阶段删除旧实现             |
| "完成"无法复核        | 强制双版本同路由同数据同视口证据                       |
| 与 Agent 活动架构冲突 | 共享 COD-354 事件与状态契约，只迁移呈现层              |

## 12. 现场证据（Phase 0 静态枚举）

- 双方路由差异：见 §4
- 双方页面/组件差异：见 §5
- 样式资产差异：见 §6
- Alan 33 个 stories vs 当前 73 个 stories（当前覆盖更广，需按状态矩阵补全）
- Alan 11 个 e2e spec vs 当前 22 个（当前覆盖更广）
- i18n：Alan en.json 33,829 B vs 当前 90,117 B（当前键量 2.7x，多语言能力保留）

## 13. Phase 1 首个 slice：共享侧栏宽度与折叠语义

本 slice 只迁移 Alan 全局壳层中可独立验证的侧栏行为，不改变业务 API、路由、Store、Canvas 状态或 Web/Desktop 的数据契约：

| Alan 语义                    | 当前实现                                                                                                 | 结论             | 代码证据                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| 默认侧栏宽度 236px           | Web wrapper 继续由 `apps/app/src/components/AppLayout.tsx` 配置；shared 恢复 COD-124 默认 provider       | 适配后复用       | `apps/app/src/components/AppLayout.tsx`、`packages/views/src/components/AppLayout.tsx`、§38 |
| 可调范围 200–360px           | Web wrapper 保留 develop 的 `minWidth={200}` / `maxWidth={360}`；shared 不再覆盖 COD-124 provider 默认值 | 当前承接         | 同上                                                                                        |
| 拖拽到不可用宽度时折叠       | 共享 `SidebarRail` 保留拖拽/折叠能力，当前壳层使用默认阈值                                               | 当前等价实现承接 | `packages/ui/src/sidebar.tsx`、`SidebarRail.unit.test.tsx`、§38                             |
| 键盘调整、点击切换、宽度记忆 | 既有 `SidebarRail` 与 `widthStorageKey` 保留                                                             | 当前等价实现承接 | `packages/ui/src/sidebar.tsx`、`SidebarRail.unit.test.tsx`                                  |

定向证据：

- `packages/views` `SidebarRail.unit.test.tsx`：5 tests passed，包含 168px Alan 折叠阈值场景；
- `packages/ui` `check-types`：exit 0；`lint`：exit 0；
- `packages/views` `check-types`：exit 0；
- `apps/app` `check-types`：exit 0；
- 受影响文件 formatter check：exit 0；`git diff --check`：exit 0；
- 运行时使用隔离 PGlite 数据目录和 7 个迁移，`GET /` 与 `GET /api/local-session` 均返回 HTTP 200；
- 2026-08-18 的 COD-124 壳层恢复与 Canvas 桌面浏览器证据见 §38；侧栏拖拽细节仍由 `SidebarRail.unit.test.tsx` 覆盖，未把未执行的拖拽动作宣称为浏览器完成。

## 14. Phase 1 第二个 slice：Canvas 状态动效与 Reduced Motion

本 slice 迁移 Alan 的 Canvas 视觉语义，并复用当前 `NodeRunStatus`，不引入第二套运行状态或事件协议：

| Alan 语义                     | 当前实现                                                                                                           | 结论             | 代码证据                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------ |
| Canvas 网格与画布板网格 token | 共享 `canvas.css` 提供 `.canvas-grid` / `.canvas-board-grid`                                                       | 直接复用         | `packages/views/src/pages/CanvasPage/canvas.css` |
| 运行节点柔和脉冲              | `NodeCard` 在 `runStatus=running` 时使用 `.node-running`                                                           | 适配后复用       | `NodeCard.tsx`、`NodeCardFrame.tsx`              |
| 完成/失败/空闲状态 wash       | Run Console 时间线与错误块映射现有状态到 `.status-wash-success/error/muted`                                        | 适配后复用       | `RunConsole.tsx`                                 |
| 连线流动与 hover 反馈         | React Flow animated edge 使用 `.react-flow__edge.animated` 规则                                                    | 当前等价实现承接 | `canvas.css`、`CanvasFlow.tsx`                   |
| 节点/面板/抽屉/配置进入动效   | 共享 CSS 提供 `.node-appear`、`.fade-rise`、`.panel-in`、`.drawer-in`、`.node-config-card`、`.edge-inspector-card` | 直接复用         | `canvas.css`                                     |
| Reduced Motion                | Canvas 根节点及 descendants 统一缩短动画/过渡并关闭平滑滚动                                                        | 适配后复用       | `canvas.css`、`CanvasFlow.tsx`                   |

定向证据：

- CanvasFlow + NodeCard：2 个测试文件、29 tests passed；
- `packages/views` typecheck：exit 0；Canvas 受影响文件 lint：exit 0；formatter 与 `git diff --check`：exit 0；
- Canvas 的编辑、连接、删除、撤销/重做和交互禁用语义仍由原有 store 与 CanvasFlow 测试覆盖；本 slice 只改变呈现层 class/CSS。
- 2026-08-17 已在 `http://localhost:9430/canvas?id=pipeline-1786937112479` 真实浏览器确认网格、浮层、节点/Agent/Run Console 运行态；五视口无横向溢出与面板互斥结果见 §23，状态矩阵见 §24。

## 15. Phase 1 第三个 slice：Canvas 面板进入与运行反馈动效

本 slice 将 Alan 的面板层动效接到当前已存在的挂载边界，确保动画只表达“进入/运行反馈”，不改变面板开关、消息流或运行状态：

| 表面                    | 当前承接                            | 结论       | 代码证据                                                    |
| ----------------------- | ----------------------------------- | ---------- | ----------------------------------------------------------- |
| Canvas 顶部标题与工具栏 | `.fade-rise`                        | 适配后复用 | `CanvasTopChrome.tsx`                                       |
| 组件库与 Inspector      | `.panel-in`                         | 适配后复用 | `CanvasComponentPanel.tsx`、`CanvasNodePropertiesPanel.tsx` |
| Settings Drawer         | `.drawer-in`                        | 适配后复用 | `CanvasSettingsDrawer.tsx`                                  |
| Agent Panel             | `.panel-in`；活动指示点改用 `.ping` | 适配后复用 | `AgentPanel.tsx`                                            |
| Run Console             | `.fade-rise`                        | 适配后复用 | `RunConsole.tsx`                                            |

定向证据：

- CanvasTopChrome、CanvasComponentPanel、CanvasNodePropertiesPanel、CanvasSettingsDrawer、AgentPanel、RunConsole：6 个测试文件、46 tests passed；
- `packages/views` typecheck：exit 0；受影响文件 formatter 与 `git diff --check`：exit 0；
- AgentPanel 的全文件 lint 仍被迁移前既有 `no-try`、handler 命名、JSX prop 排序问题阻塞；本 slice 未修改这些业务/规则问题。
- 2026-08-17 已在 9430 Canvas 和 9460 Storybook 真实浏览器确认浮层、面板进入与 Run Console 运行态；Agent Panel 拖拽专项证据见 §34。

## 16. 累计验证

- `packages/views` 全量 Vitest：87 个测试文件、383 tests passed；
- `apps/app` production build：成功，client 4349 modules、SSR 3871 modules transformed；仅有既有 route-test、chunk size 和第三方 eval warnings；
- `apps/app` Storybook production build：成功，4195 modules transformed；构建提示仅包含既有 package.json 查找、无 MDX story 和 chunk size warnings；
- 真实浏览器双基线对照地址固定为 `http://localhost:9430` 与 `http://localhost:9440`；已取得的页面、Canvas 五视口和 Storybook 状态证据分别记录在 §17–§24，未覆盖的交互仍按矩阵保留。

## 17. Phase 1 第四个 slice：Alan 全局壳层信息架构

本 slice 的历史记录保留为迁移过程证据；最终壳层已按用户反馈恢复到已提交的 COD-124 结构，详见 §38。

| Alan 语义                       | 当前承接                                                                            | 结论       | 代码证据                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| 项目切换入口与 develop 项目逻辑 | `ProjectSwitcher` 恢复为 COD-124 的项目按钮壳层，筛选/创建逻辑不变                  | 适配后复用 | `packages/views/src/components/ProjectSwitcher.tsx`、`AppSidebar.tsx` |
| 侧栏搜索入口                    | `AppSidebar` 恢复为 COD-124 的 `SidebarMenuButton`，点击继续打开 develop 搜索对话框 | 适配后复用 | `AppSidebar.tsx`、`SearchPipelineDialog.tsx`                          |
| 搜索结果与导航筛选              | 不再由侧栏本地 inline query 过滤；由既有 SearchPipelineDialog/Store 承接            | 当前承接   | `SearchPipelineDialog.tsx`、`sidebarStore`                            |
| Alan 原有导航                   | 保留并扩展 Operations、Objects、Distillations、Agents、Plugins 等 develop 新能力    | 当前承接   | `AppSidebar.tsx`                                                      |

定向证据：

- AppSidebar + ProjectSwitcher 的定向测试通过；`sidebarStore` 保持 develop 原契约；
- `packages/views` typecheck、受影响文件 lint/format、`git diff --check` 均通过；
- 历史预览记录保留；最终恢复证据、当前 DOM 几何和真实搜索交互见 §38。

## 18. Phase 2 第一个 slice：Pipelines 列表页面密度与空态

本 slice 保留当前 Pipelines 的指标、标签、项目筛选、调度和详情路由，只迁移 Alan 的页面级布局语义：

| Alan 语义                             | 当前承接                                                                        | 结论       | 代码证据                   |
| ------------------------------------- | ------------------------------------------------------------------------------- | ---------- | -------------------------- |
| 筛选 chip 带数量并保持单行密度        | `All/Saved Skills/Drafts/Scheduled` 映射当前四种 filter，并从真实数据计算 count | 适配后复用 | `PipelinesPageContent.tsx` |
| 搜索靠右、工具栏无额外厚边框          | `SearchInput ml-auto w-60`，标签筛选继续保留在下一行                            | 适配后复用 | `PipelinesPageContent.tsx` |
| 空态使用圆角 surface-2 容器和二级说明 | 当前空数据/无结果均使用 Alan 风格容器，业务文案继续走 i18n                      | 适配后复用 | `PipelinesPageContent.tsx` |
| 卡片网格密度                          | `xl:grid-cols-2`、`2xl:grid-cols-3`，保留当前 PipelineCard 指标与动作           | 适配后复用 | `PipelinesPageContent.tsx` |

浏览器证据：`http://localhost:9430/pipelines` 已显示计数筛选、右侧搜索、草稿卡片和当前新功能动作；Alan 对照页面为 `http://localhost:9440/pipelines`。

## 19. Phase 2 第二个 slice：Canvas Workspace 空间关系

本 slice 将当前 Canvas 从“隐藏全局壳层的独立全屏模式”适配为 Alan 的 Workspace 关系：

| Alan 语义                               | 当前承接                                                                                             | 结论       | 代码证据                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| Workspace 保留全局侧栏                  | Web/桌面 Canvas 路由使用普通 `AppLayout`，不再传 `canvasMode`；Desktop 使用 embedded Canvas          | 适配后复用 | `apps/app/src/routes/canvas.tsx`、`apps/desktop-app/src/routes/canvas.tsx` |
| Workspace 不再额外显示 Canvas mini rail | 真实路由传 `showCanvasMiniSidebar={false}`；组件面板可见性继续由 develop 的 `isSidebarOpen` 状态决定 | 适配后复用 | `CanvasPage.tsx`、`CanvasPageContent.tsx`、`CanvasInner.tsx`、`uiSlice.ts` |
| 顶部浮动标题 pill                       | 标题输入、组件面板入口、设置入口采用绝对定位浮层                                                     | 适配后复用 | `CanvasTopChrome.tsx`                                                      |
| 工具栏悬浮在画布底部                    | `CanvasToolbar` 从顶栏移到主画布右下浮层                                                             | 适配后复用 | `CanvasInner.tsx`                                                          |
| Agent Bar/Panel 右侧停靠                | 6px 独立 resize gutter + 浮动 panel region；可拉伸 Agent Panel 行为保留                              | 适配后复用 | `CanvasInner.tsx`                                                          |

真实浏览器证据：`http://localhost:9430/canvas?id=pipeline-1786937112479` 已显示全局侧栏、浮动标题、底部工具栏、空画布和右侧 Agent 面板；Alan 对照通过 `http://localhost:9440/pipelines → New Pipeline → /workspace/pipeline-*` 取得有效 Workspace。

## 20. Phase 2 第三个 slice：Canvas 顶部浮层与底部工具栏

在 §19 的 Workspace 空间关系上继续对齐 Alan 的 Canvas chrome：

- `CanvasTopChrome` 从占据整行的 border bar 改为浮动标题 pill，并保留组件面板/设置入口；
- `CanvasToolbar` 从顶部布局流移到画布右下角浮层；
- `CanvasInner` 根节点纳入 Canvas Reduced Motion 范围；
- 生产路由不再显示 Alan 之外的 Canvas mini rail；组件面板默认值、开关和宽度状态继续以 develop 的 `uiSlice` 为准，顶部入口只调用现有 action。

真实浏览器截图已确认当前 develop Canvas 与 Alan Workspace 共享“全局侧栏 + 干净画布 + 右侧 Agent + 浮动 chrome”空间关系。

## 21. Phase 2 第四个 slice：Agent Panel 空态引导与上下文入口

本 slice 只迁移 Agent Panel 的呈现和入口交互：

- 空会话显示 Alan 风格的说明文案与三条建议目标；
- 教材测验、GitHub changelog 建议直接复用现有 `handleComposerSubmit`；
- 成品样本建议填充现有 Composer 草稿，附件上传仍走当前 `pipelineAgentSessionsClient`；
- Context Strip、Runtime 选择、Proposal、Diagnostics 和 Composer 状态协议保持 develop 实现；
- Web/Desktop 语言包同步补齐 `canvas.agentPanel.empty.*`，避免界面泄漏 key。

证据：AgentPanel + Composer 4 files / 30 tests、messages 12 tests passed；完整 Canvas E2E 真实发送 Agent 消息并收到 mock response。真实 `9430/canvas` 与 1440/701/390 截图均显示 Alan 式 header/body/footer，同时保留 runtime 选择。

## 22. Phase 2 第五个 slice：RunConsole 视觉承接

本 slice 只迁移 Alan 的 RunConsole 呈现，不增加或迁移状态能力：

- 保留 develop 已有的 `pipelineId`、`activeJobId`、`isConsoleOpen`、Job 轮询、trace parser、节点运行状态和产物解析；
- 状态启动、刷新恢复、关闭 Console 和错误处理继续由 develop 原有实现负责；
- Alan 的浮动 `inset-x-3 bottom-16` shell、compact header、mono 10.5px log 和 error wash 只改变呈现；不写入新的 session storage 或恢复 action。

证据：`RunConsole.unit.test.tsx` 8 tests passed；Storybook production build 4206 modules；9460 Running/Completed/Failed 截图位于 `pr-assets/cod-355/runconsole-*-1200x500.png`，Loading/Queued 仍由同一 story matrix 覆盖。此前临时 `RunStateRestorer`/`runStateStorage` 已移除。

## 23. Phase 4 第一个 slice：Canvas 窄视口层级互斥

真实 Canvas 视口矩阵复验结果：

| 视口     | 横向溢出 | Agent shell   | 组件面板         | 移动/TopChrome 证据                 |
| -------- | -------- | ------------- | ---------------- | ----------------------------------- |
| 1440×900 | 无       | 344px         | 230px 浮层       | Alan desktop pill                   |
| 1180×820 | 无       | 344px overlay | Agent 打开时隐藏 | controls right ≤ 1168               |
| 981×820  | 无       | 344px overlay | Agent 打开时隐藏 | controls right ≤ 969                |
| 701×820  | 无       | 344px overlay | Agent 打开时隐藏 | mobile trigger z50 > chrome z20     |
| 390×844  | 无       | 389px 满宽    | Agent 打开时隐藏 | icon-only States/Run，right ≤ 382px |

在 1180px 及以下，Agent 打开时不再让组件面板与 Agent overlay 互相遮挡；390px 的移动 trigger、TopChrome、Agent 和 composer 均有真实截图与 bounding-box 断言。NodeConfig/EdgeInspector 同时保留 440/420px 桌面宽度并增加 viewport max-width。

## 24. Phase 4 第二个 slice：Run Console 状态表达矩阵

本 slice 只补齐可复现的视觉验收状态，不改变 develop 的运行状态机：

| 状态      | Storybook 入口                                   | 证据                                 |
| --------- | ------------------------------------------------ | ------------------------------------ |
| Loading   | `/?path=/story/canvaspage-runconsole--loading`   | `控制台 / 加载中...`                 |
| Queued    | `/?path=/story/canvaspage-runconsole--queued`    | `排队中`、空时间线                   |
| Running   | `/?path=/story/canvaspage-runconsole--running`   | `运行中`、日志、当前步骤、节点时间线 |
| Completed | `/?path=/story/canvaspage-runconsole--completed` | `完成`、空时间线                     |
| Failed    | `/?path=/story/canvaspage-runconsole--failed`    | `失败`、develop Job error 文案       |

实现位于 `packages/views/src/pages/CanvasPage/RunConsole/RunConsole.stories.tsx`，通过现有 `canvasStoryDataProvider` 的 `Job`、`JobStatus` 和 `jobs/traces` 数据承接；没有引入 Alan 的状态或 Store。2026-08-17 已在 `http://localhost:9460` 真实浏览器逐项打开上述 5 个入口，均渲染 `控制台`，状态文案和错误态内容符合预期。Run Console 当前没有独立的 disabled 业务控件，因此未伪造 disabled 状态；该状态由仍在 develop 中的页面控件矩阵承接。

## 25. Phase 3 第一个 slice：全局搜索对话框密度

本 slice 迁移 Alan 的搜索呈现，不扩展或替换 develop 的搜索业务契约：

- 对话框改为 Alan 式 `sm:max-w-2xl`、紧凑搜索行、分组标题、圆角结果行、图标方块和状态 Tag；
- 空查询显示工作区搜索引导，无结果保留当前 Pipeline 空态；
- 查询使用 `SearchPipelineDialog` 本地 UI state，关闭/选中后清理，不向共享 Store 添加 Alan 字段；
- 数据仍只读取 develop `ResourceName.pipelines`，选中仍调用 develop `/canvas` search 参数，未引入 Alan 旧路由或旧实体。

证据：`SearchPipelineDialog.unit.test.tsx` 3 tests passed；`packages/views` typecheck、定向 oxlint/oxfmt 通过；真实浏览器 `http://localhost:9430/pipelines` 使用 `Ctrl+K` 打开对话框，输入 `新建` 后显示 `流水线 / 新建 Pipeline / draft`，点击结果导航到 `http://localhost:9430/canvas?id=pipeline-1786937112479`。

## 26. Phase 3 第二个 slice：Jobs 页面工具栏与空态

本 slice 只对齐 Alan 的页面层布局，保留 develop Job 运行控制、列表/日历切换、Routine 编辑器、状态筛选和详情抽屉：

| Alan 语义                   | 当前承接                                                              | 结论       | 代码证据                                               |
| --------------------------- | --------------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| 无厚边框的紧凑工具栏        | 工具栏移除 `border-b/bg`，改为 `px-7 pb-3.5` 并右对齐筛选/搜索        | 适配后复用 | `JobsPageContent.tsx`                                  |
| 列表/日历 Segmented Control | 保留 develop 两种视图和现有 `JobsCalendar` 数据                       | 当前承接   | `JobsPageContent.tsx`、`JobsPageContent.unit.test.tsx` |
| 圆角 surface 空态           | 空结果使用 `rounded-2xl bg-surface-2/50`                              | 适配后复用 | `JobsPageContent.tsx`                                  |
| 圆角排程选择器              | 保留当前 Pipeline/Routine 选择和 ScheduleEditor，调整为 `rounded-2xl` | 适配后复用 | `JobsPageContent.tsx`                                  |

证据：`JobsPageContent.unit.test.tsx` 4 tests passed；真实浏览器 `http://localhost:9430/pipelines/jobs` 已验证列表 → 日历切换及“新建 Routine”打开 Pipeline 选择器，截图记录了全局壳层、日历和选择器。

## 27. Phase 3 第三个 slice：Components 页面资产库密度

本 slice 对齐 Alan 的组件库布局，同时完整保留 develop 之后新增的 Operation、Pipeline Asset、组件推荐和删除引用检查：

- 工具栏去除厚边框，改为 Alan 式分类 chip + 右侧搜索密度；
- 资产网格在 `xl` 使用两列、`2xl` 使用三列，保持当前内置输入对象、输出对象、Operation 和 Pipeline Skill；
- 无匹配结果改为圆角 surface 空态；
- `Find for me`、新建 Operation、蒸馏 Pipeline Skill、编辑/删除和 usage-count 查询均未改变。

证据：`ComponentsPageContent.unit.test.tsx` 7 tests passed；真实浏览器 `http://localhost:9430/components` 已验证搜索 `文件` 只保留文件夹/文件卡片，并打开“新建组件”菜单显示 `新建操作` 与 `蒸馏 Pipeline Skill`；截图记录了筛选、卡片网格和菜单。

## 28. Phase 3 第四个 slice：Operations 页面工具栏与空态

本 slice 对齐 Alan 的 Operations 页面层级，保留 develop 的导入、创建、搜索、排序和 Grid/List 视图：

| Alan 语义           | 当前承接                                                                | 结论       | 代码证据                    |
| ------------------- | ----------------------------------------------------------------------- | ---------- | --------------------------- |
| 轻量搜索/排序工具栏 | `bg-muted/30` + 紧凑输入/Select，保留当前 Store 排序字段                | 适配后复用 | `OperationsPageContent.tsx` |
| Grid/List 内容区    | Alan 式 grid 间距与无额外厚卡片的 List 分隔线，现有两种视图 action 保持 | 适配后复用 | `OperationsPageContent.tsx` |
| 空态                | 保留 develop 创建入口与清空搜索动作，布局对齐 Alan 空态                 | 当前承接   | `OperationsPageContent.tsx` |

证据：受影响文件 typecheck、oxlint、oxfmt 通过；真实浏览器 `http://localhost:9430/pipelines/operations` 显示轻量工具栏、排序 Select、Grid/List 控件和本地化内容；隔离数据已包含 `COD355 Visual Check` 与 Canvas E2E Operation，卡片/列表态已进入截图证据。

## 29. Phase 3 第五个 slice：Settings 分组导航与内容列

本 slice 只迁移 Alan 的 Settings 页面层级，不替换 develop 的 Settings Store 或 section 行为：

- 页面标题去除 develop 额外副标题，保留 Alan 简洁 header；
- 内容列从 `max-w-2xl` 收窄到 Alan 的 `max-w-lg`；
- 桌面分组导航、移动端横向导航、语言/主题/时区表单、键盘帮助对话框均继续使用 develop 实现；
- Web/Desktop 共享 `packages/views`，没有创建平行设置页面或迁移旧配置状态。

证据：`SettingsPageContent.unit.test.tsx` 5 tests passed；真实浏览器 `http://localhost:9430/settings` 刷新后确认无副标题，点击“默认项”切换 section，点击“快捷键”打开帮助对话框；截图记录了分组导航与键盘帮助状态。

## 30. Phase 3 第六个 slice：Pipeline / Job 详情当前承接

这两个详情页的主要 UI 结构在 develop 中已保持 Alan 的成熟层级，本轮完成真实页面钉证，不复制 Alan 的旧路由或状态：

| 页面            | 真实路径                                               | 当前承接                                                                |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Pipeline Detail | `/pipelines/pipeline-1786937112479`                    | 头部返回/Canvas/蒸馏动作、信息卡、统计、Canvas 预览、运行面板和空节点态 |
| Job Detail      | `/pipelines/jobs/99365c14-3671-4f45-a665-6a5c2742aea9` | 完成状态 pill、状态色条、基本信息、Agent Runs 空态、3 条真实 trace 日志 |

2026-08-17 真实浏览器证据：Pipeline Detail 显示 `PIPELINE 预览`、`全屏编辑 →`、`执行流水线`；Job Detail 显示 `完成`、`智能体运行`、`日志` 和 `Pipeline complete...`。两页继续使用 develop 的 `PipelineData`、`Job`、`JobTrace`、蒸馏入口和 Canvas 路由，不迁移 Alan 旧状态。

## 31. Phase 4 第三个 slice：Playwright 页面回归证据

在实施 worktree 使用隔离端口和 Playwright 临时 PGlite 数据执行：

```powershell
$env:PLAYWRIGHT_PORT = "9472"
bun run test:e2e -- e2e/canvas.e2e.spec.ts e2e/pipelines.e2e.spec.ts e2e/components.e2e.spec.ts e2e/operations.e2e.spec.ts e2e/jobs.e2e.spec.ts e2e/settings.e2e.spec.ts
```

旧的 9472 运行曾为 10/11；其阻塞已在后续 Canvas 直接移植回合消除。最终在稳定 9430 一次运行：

```powershell
$env:PLAYWRIGHT_PORT = "9430"
bun run test:e2e -- canvas.e2e.spec.ts pipelines.e2e.spec.ts components.e2e.spec.ts operations.e2e.spec.ts jobs.e2e.spec.ts settings.e2e.spec.ts frontend-acceptance.e2e.spec.ts
```

结果为 `14 passed (1.6m)`。真实覆盖：五视口、StateLegend、组件菜单、QuickAdd/右键菜单、Folder + NodeConfig、File 拖入、Operation 创建、NodeCard 移动、Undo/Redo、12px ports、SemanticEdge、EdgeInspector、保存/刷新恢复、Agent Composer、六页面回归、主题/语言、键盘焦点、reduced motion 与 Axe。最终交互最大值 1156ms，`p95FrameGapMs=17`、`maxLongTaskMs=0`；Pipelines/Canvas serious/critical Axe violations 均为 0。

## 32. Phase 3 第七个 slice：Capabilities 页面当前承接

2026-08-17 在 9430 实施预览逐页打开以下路由，并记录了共享壳层与关键交互：

| 页面         | 浏览器证据                                                                                  | 状态边界                                                 |
| ------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Connectors   | `/connectors` 显示 7 个 MCP 卡片；点击 `通过 MCP` 保持筛选区和测试/管理动作                 | 继续使用 develop Connector schema、连接/测试 API         |
| Agents       | `/agents` 显示空态和 `创建智能体`；打开创建表单可见名称、描述、默认运行时、系统提示词和标签 | 继续使用 develop Agent Store/API 与运行时枚举            |
| Local Agents | `/local-agents` 显示本机扫描说明、7 个运行时和 `重新扫描`                                   | 扫描结果依赖本机 CLI，不固定为 Alan 数据                 |
| Skills       | `/skills` 显示 210 个技能、来源筛选、导入预览和卡片；输入 `Yuanbao` 只保留对应卡片          | 继续使用 develop Skill schema、导入和 Operation 生成入口 |
| Plugins      | `/plugins` 显示 GitHub Projects 插件版本和对象类型                                          | 当前 develop 插件注册能力完整保留                        |
| Usage        | `/usage` 显示 Token 趋势、Pipeline/Agent 汇总和空数据说明                                   | 继续使用 develop 用量查询和本地 Token 语义               |

这些页面未发现需要复制 Alan 旧状态机的视觉差异，故记录为“适配后复用”或“当前承接”，不新增平行 UI。截图和交互记录由本轮浏览器预览留存。

## 34. Phase 4 第四个 slice：Agent Panel 拖拽与窄视口层级

在 9430 Canvas `1280×720` 真实浏览器中，Agent Panel resize handle 从 `x=935` 拖到 `x=875`：

- shell 宽度从 `344px` 变为 `404px`；
- shell right 保持 `1280px`，`document.scrollWidth=1280`、`clientWidth=1280`，无横向溢出；
- 与 Canvas 顶部浮层之间使用 `top-16` 对齐，窄视口 E2E 的几何断言不再因 `top-14` 产生 7px 间隙；
- develop 的 `agentPanelWidth`、`setAgentPanelWidth`、折叠 action 和 Agent 内容保持不变，仅修正布局呈现。

证据：`CanvasInner.unit.test.tsx` 与相关 chrome/modal 定向矩阵通过；真实拖拽结果和截图已留存。旧 Notifications/Local Agents 阻塞已由固定 runtime seed 消除，最终全量结果见 §31 的 14/14。

## 33. Phase 3 第八个 slice：Operation 表单与错误页承接

- `http://localhost:9430/pipelines/operations/new` 已验证 Alan 式窄卡片表单、对象类型 chip、Agent/Script 执行方式切换；切到 Script 后出现脚本命令和语言字段；
- 在隔离 PGlite 中创建了 `COD355 Visual Check`（`op-1786941891496`），真实导航到详情页并显示运行/编辑/输出项/基本信息/元数据；点击编辑后真实打开 `/pipelines/operations/op-1786941891496/edit`，显示身份与范围、执行契约、数据契约和摘要；
- 创建/编辑/详情继续使用 develop Operation schema、Store、创建 API 和输出模板能力，没有恢复 Alan 旧实体；
- 认证页源码继续使用 develop `AuthShell`、邮箱/OAuth 表单和现有 auth hook。因本地模式会自动创建/恢复 `Local User` 会话，访问 `/login` 在真实浏览器会按现有 develop 行为回到 `/`，因此没有把匿名登录页截图冒充为已验收；
- 访问未知路由 `/route-that-does-not-exist` 显示 `404 — 页面不存在`，空白页级错误态已记录。

## 35. Phase 2 Canvas 直接移植回合：Alan 原 JSX/class + develop 逻辑

本回合不再用“近似设计”重画 Canvas，而是以 Alan 固定提交逐文件复制呈现结构，再把 develop 的数据与 action 接回：

| 表面               | Alan 源                                             | 当前落点                                     | develop 权威逻辑                                                            | 定向证据                           |
| ------------------ | --------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------- |
| Components menu    | `canvas/chrome/ComponentPanel.tsx`                  | `CanvasComponentPanel.tsx`                   | sidebar UI、operations/skills query、generic Compound、create/drag handlers | 7 tests                            |
| NodeCard + ports   | `nodes/GNodeShell.tsx`、`support/NodeCardPorts.tsx` | `NodeCard/*` + develop 节点                  | node fields、run status、focus/Agent/duplicate/remove、port masks/counts    | 8 files / 54 tests + body 41 tests |
| TopPill + States   | `canvas/chrome/TopPill.tsx`、`StateLegend.tsx`      | `CanvasTopChrome.tsx`、`CanvasStatusBar.tsx` | title/save/settings/run/runtime/Agent + develop summary                     | 3 files / 19 tests                 |
| Toolbar            | `canvas/chrome/CanvasToolbar.tsx`                   | `CanvasToolbar.tsx`、`CanvasInner.tsx`       | tool/zoom/fit + develop-only undo/redo/layout/quick-add/delete menu         | 2 files / 21 tests                 |
| Semantic edge      | `canvas/edges/SemanticEdge.tsx`                     | `SemanticEdge/*`、`CanvasFlow.tsx`           | selected edge、proposal、node statuses、PipelineEdgeData、edge click        | 2 files / 18 tests                 |
| Edge Inspector     | `panels/EdgeInspector/EdgeInspector.tsx`            | `CanvasEdgeInspector/*`                      | selectedEdgeId、updateEdgeData、clearSelection                              | 2 tests                            |
| Empty state        | `canvas/CanvasEmptyState.tsx`                       | `CanvasEmptyState/*`                         | current quick-add action                                                    | 2 tests                            |
| NodeConfig         | `panels/NodeConfig/NodeConfig.tsx`                  | `CanvasNodePropertiesPanel/*`                | every develop node field/update handler                                     | Properties + Inner 27 tests        |
| Agent/Composer     | `WorkspacePage/AgentBar/*`                          | `CanvasPage/AgentPanel/*`                    | runtime/session/upload/stream/proposal/diagnostics                          | 30 + 12 tests                      |
| RunConsole         | `canvas/run/RunConsole.tsx`                         | `CanvasPage/RunConsole/*`                    | Job polling/traces/timeline/artifacts                                       | 8 tests                            |
| Current-only menus | Alan component-row grammar                          | Canvas/Node/Connection/QuickAdd menus        | all develop create/connect/group/ungroup/detach actions                     | 4 files / 5 tests                  |

Sol 审查中发现并修复两类“看似复制、实际仍偏差”的问题：共享 `Card` 会注入 `gap-3/py-3`，已改回 Alan 原生 `<div>`；SemanticEdge map 推断成窄类型导致 `ReactFlowInstance` typecheck 失败，已用原 `PipelineEdge[]` 宽类型承接。两处修复后的 `packages/views` typecheck 均为 exit 0。

当前截图：

- Alan：`pr-assets/cod-355/canvas-1440x900-alan.png`
- 直接移植后：`pr-assets/cod-355/canvas-direct-port-1440x900.png`
- 旧 Before/After/Diff：`pr-assets/cod-355/canvas-1440x900-{before,after,diff}.png`
- NodeCard：`pr-assets/cod-355/canvas-nodecard-1440x900-{alan,before,after,diff}.png`
- 五视口 After：`canvas-{1440x900,1180x820,981x820,701x820,390x844}-after.png`
- RunConsole：`runconsole-{running,completed,failed}-1200x500.png`

截图中的业务数据、中文/英文内容与 Alan 可不同；评审目标是布局、密度、组件形状、层级和交互语法。Store、API、Schema、运行状态与安全约束全部继续以 develop 为准。

## 36. 最终质量矩阵与基线例外

本节区分既有浏览器/截图记录与固定 Alan SHA 的 fresh visual evidence；后者在 harness 阻塞时不记为通过。

| 验收项                       | 最终结果                       | 证据                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/views` 全量单测    | 通过                           | 91 files / 397 tests                                                                                                                                                                                                                                                                                                                       |
| `apps/app` 全量单测          | 通过                           | 141 files / 664 tests                                                                                                                                                                                                                                                                                                                      |
| views/app/ui typecheck       | 通过                           | 三命令 exit 0                                                                                                                                                                                                                                                                                                                              |
| Desktop 直接 tsc             | 历史基线失败                   | 当前与 `cod-355-before-5771dce` 输出一致：platform headers、sidecar null、React 双类型、Distillation 路由；Canvas/locale 不在错误列表                                                                                                                                                                                                      |
| app lint                     | 历史基线失败                   | 当前与 Before 均为 `pendingPipelinePrompt.ts:36` no-try + Pipeline route func-style warning                                                                                                                                                                                                                                                |
| desktop/ui lint              | 通过                           | desktop 仅 2 条既有 func-style warning，exit 0；ui exit 0                                                                                                                                                                                                                                                                                  |
| 新增 Canvas 文件定向 lint    | 通过                           | EdgeInspector/SemanticEdge/useNodeCardActions exit 0                                                                                                                                                                                                                                                                                       |
| Visual evidence spec lint    | 通过                           | `apps/app/e2e/alan-migration.visual.e2e.spec.ts` 定向 oxlint exit 0；全量 app lint 仅保留 `pendingPipelinePrompt.ts:36` no-try 与 Pipeline route func-style 历史基线问题                                                                                                                                                                   |
| changed-file format / diff   | 通过                           | 当前 worktree `git status --short --untracked-files=all` 为 97 个 changed text files（83 tracked + 14 untracked）；本文件 `oxfmt --check` 与 `git diff --check` 均 exit 0                                                                                                                                                                  |
| Web production build         | 通过                           | `apps/app` client 4354、SSR 2209 modules                                                                                                                                                                                                                                                                                                   |
| Desktop production build     | 通过                           | 4180 modules                                                                                                                                                                                                                                                                                                                               |
| Root turbo build             | 历史基线失败                   | Web/Desktop/docs/cli 构建完成；`apps/create` 在 Windows 执行 Unix `cp -r` 报 `cp: illegal option -- r`，失败文件未被 COD-355 修改                                                                                                                                                                                                          |
| Storybook production build   | 通过                           | 4206 modules；Objects/SemanticEdge/EdgeInspector/Node/Run stories 在产物中                                                                                                                                                                                                                                                                 |
| 页面 + acceptance Playwright | 通过                           | 页面/Canvas 历史完整套件 14/14；最终 `frontend-acceptance.e2e.spec.ts` 3/3，主题/语言、键盘、reduced-motion、Pipelines/Canvas Axe serious/critical=0                                                                                                                                                                                       |
| Visual evidence Playwright   | 通过（迁移侧）                 | `pr-assets/cod-355` 已生成最新 Alan/Before/After/Diff、NodeCard Alan/Before/After/Diff 与 Canvas 五视口截图；visual spec 最终 2 passed。Alan Canvas 通过真实 `/pipelines → New Pipeline` 取得有效 Workspace，NodeCard 通过 `New Pipeline → 添加种子节点` 取得，动态 toast 已在截图阶段隐藏；9440 使用隔离 PGlite harness，未修改 Alan 源码 |
| Storybook 浏览器预览         | 通过（迁移侧） / Alan 参考阻塞 | 迁移 worktree 9471 的 NodeCard story iframe 实际显示 `Example Node`，Objects story iframe 实际显示对象目录，console 无错误；`bun run build-storybook` exit 0，4206 modules。固定 Alan 9470 manager 可列出 stories，但 iframe 保持空白/loading，直连 iframe 超时；该问题只记录为 Alan 参考基础设施阻塞，不改变迁移侧 Storybook 结果         |
| 主 checkout 隔离             | 物理隔离已确认                 | 实施 worktree 为 `D:\Coding\项目ORDINE\.worktrees\cod-355-alan-migration`；主 checkout 存在重叠脏路径，最终 status 不能单独证明变更归属；本次未提交、推送、合并或删除                                                                                                                                                                      |

根据执行规则 11，Desktop tsc 与 app lint 的任务前基线失败保留为证据，不扩展 COD-355 去修改 sidecar、Distillation 路由或错误处理架构。固定 Alan SHA 的 Storybook 参考 iframe 仍受基础设施限制，但迁移侧 fresh visual evidence、迁移侧 Storybook 浏览器预览与构建均已通过；因此本文仍不使用“仓库全面复用完成/所有质量门全绿”的表述，COD-355 作用域内新增或修改的前端行为、构建、页面 acceptance Playwright、视觉和可访问性验收已完成。

## 37. Phase 5：develop 当前承接页面浏览器钉证

本节记录 Alan 没有对应页面、但必须继续由 develop 承接的前端表面；不把它们重新解释为 Alan 迁移缺口，也不迁移 Alan 不存在的旧状态。

| 表面                  | 真实路径与交互证据                                                                                                                                                                                                     | 当前结论                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Home / Dashboard      | `/` 显示 Ordine Studio、当前本地 Agent 选择、目标输入、上传上下文和创建 Pipeline/整理重复工作/沉淀流程三个入口；390×844 emulation 下 `scrollWidth=390`，无横向溢出                                                     | 当前承接；保留 develop HomePage 与 Agent/生成入口              |
| Agents / Agent Detail | `/agents` 显示列表、搜索和创建入口；创建对话框包含运行时、模型、系统提示词、标签；`agents-workflow.e2e.spec.ts` exit 0，1 passed，覆盖创建→详情→编辑；详情页 `/agents/{id}` 在 390×844 emulation 下 `scrollWidth=390`  | 当前承接；使用 develop Agent Store/API/Schema                  |
| Objects               | `/pipelines/objects` 显示文件、文件夹和 GitHub Projects 对象卡片；点击 GitHub Projects 进入 `/pipelines/objects/github-project`，显示“暂无对象”空态；390×844 emulation 下 `scrollWidth=390`，无横向溢出                | 当前承接；使用 develop plugin registry 与对象查询              |
| Runtimes              | `/runtimes` 显示 19 个本机 Agent；点击“重新扫描”进入“扫描中...”禁用态；点击 Hermes“配置”进入 `/runtimes/local-hermes`，再进入 `/edit` 显示编辑表单；390×844 emulation 下 `clientWidth=380/scrollWidth=380`，无横向溢出 | 当前承接；使用 develop runtime Store、扫描 API、详情和编辑路由 |
| Distillations         | `/distillations` 显示空态和“打开蒸馏室”；`/distillation-studio` 显示标题、来源类型、模式、来源、目标、Runtime、模型覆盖和保存/运行操作；`distillations-workflow.e2e.spec.ts` exit 0，1 passed                          | 当前承接；创建、编辑、刷新恢复、删除均由 develop 业务逻辑负责  |
| Assistant             | `/assistant` 真实显示当前 develop 的 `Hello "/assistant"!` 占位路由；Alan 无对应页面                                                                                                                                   | 当前承接；本轮不虚构 Assistant 业务或 Alan 视觉迁移            |

## 38. Phase 5 第二个 slice：恢复已提交的 COD-124 侧边栏壳层

用户明确要求恢复之前已经提交过的侧边栏，而不是继续保留本轮 Alan 视觉改造后的临时壳层。本 slice 以 Git 提交 `5cfcd232`（`feat: 完成侧边栏导航与项目切换（COD-124）`）为视觉/布局源，手工恢复 shared `packages/views` 的对应结构；没有 cherry-pick 整个提交，也没有恢复其中的旧业务路由或旧状态。

### 源码变更

| 文件                                                | 恢复内容                                                                                                                                        | develop 保留项                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/views/src/components/AppSidebar.tsx`      | `border-r bg-sidebar`、`border-b px-2 py-2`、`h-8` 品牌行、`Workflow` Logo、`right-0.5/top-0.5` Trigger、独立 `SidebarMenuButton` 搜索/新建入口 | Components、Usage、Local Agents、Connectors、Distillations、Plugins、NotificationCenter、Settings 和 `handleSearchClick` fallback |
| `packages/views/src/components/ProjectSwitcher.tsx` | COD-124 的 `py-2` 容器与 `h-9 w-full` 项目按钮                                                                                                  | develop 项目查询、切换、创建和 `sidebarStore` 持久化                                                                              |
| `packages/views/src/components/AppLayout.tsx`       | 恢复 `SidebarProvider widthStorageKey`，不再由 shared 层覆盖本轮 Alan 的宽度约束                                                                | Web wrapper 的 develop 宽度配置仍在 `apps/app/src/components/AppLayout.tsx`                                                       |
| 定向单测                                            | 更新品牌/项目按钮语义断言                                                                                                                       | 业务行为断言继续覆盖搜索、项目切换和能力导航                                                                                      |

### 真实浏览器证据

- 路由：`http://localhost:9430/canvas?id=pipeline-e2e-1786957641321-0-0`。
- 视口：`1356×1032`，本地模式固定种子数据，Canvas 节点和 Agent Panel 正常显示。
- Before：用户在同一路由提交的浏览器评论截图，侧栏使用 `O / Ordine Studio / 工作区`、Primary 新建按钮和 Alan 临时项目身份条；用户标记了 Logo、新建流水线、搜索三个位置的错位。
- After（折叠）：DOM `data-state=collapsed`；Trigger `10,10,28×28`，项目/搜索/新建按钮分别为 `8,56,32×32`、`8,104,32×32`、`8,140,32×32`，图标中心统一在同一侧栏栅格。
- After（展开）：DOM `data-state=expanded`；Trigger 位于 `197,10,28×28`，项目/搜索/新建按钮均从 `x=8` 开始、宽 `219px`，无重叠。
- 交互：折叠态点击“搜索...”打开 `搜索...` 对话框；点击 Close 后回到 Canvas；点击 Toggle Sidebar 在 expanded/collapsed 两态间切换。
- 运行时：浏览器控制台 error 数为 `0`；Canvas 节点、组件面板和 Agent Panel 在侧栏切换后仍存在。
- 视觉截图：Playwright 已生成 `cod355-sidebar-collapsed-after.png` 与 `cod355-sidebar-expanded-after.png`（工具输出目录）；用户 Before 截图作为本 slice 的对照证据保留在本对话浏览器评论中。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- AppSidebar.unit.test.tsx ProjectSwitcher.unit.test.tsx
bun run check-types
Pop-Location
git diff --check -- packages/views/src/components/AppSidebar.tsx packages/views/src/components/ProjectSwitcher.tsx packages/views/src/components/AppLayout.tsx packages/views/src/components/AppSidebar.unit.test.tsx packages/views/src/components/ProjectSwitcher.unit.test.tsx
```

结果：2 个 test files / 6 tests passed；`packages/views` typecheck exit 0；`git diff --check` exit 0；本 slice 修改 5 个授权文件，未提交、推送、合并或修改主 checkout。

## 39. Phase 5 第三个 slice：紧凑 NodeCard 选中态不再误展开

用户在 9430 Canvas 反馈“点击这个卡片后就会展开”。根因是所有 develop 节点组件都使用 `nodeCardMode === "compact" && !selected`；节点一旦被 React Flow 选中，就绕过了全局紧凑模式。该行为与 Alan 的节点交互表达不一致，也使 Canvas 设置中的 Compact/Expanded 选择失去确定性。

### 实现

- `OperationNode`、`FileNode`、`FolderNode`、`GitHubProjectNode`、`OutputLocalPathNode`、`OutputProjectPathNode`、`PromptNode` 统一改为只由 `nodeCardMode` 决定 `compact`。
- 保留 `selected` 的视觉 ring、focus、hover actions 和 develop Store/API 行为；未恢复 Alan 旧状态或改变节点数据。
- 新增 `OperationNode.unit.test.tsx` 回归断言：`selected=true` 且 `nodeCardMode="compact"` 时，shell 的 `data-card-mode` 仍为 `compact`，Agent body 不渲染。

### 真实浏览器证据

- 路由：`http://localhost:9430/canvas?id=pipeline-e2e-1786957641321-0-0`，视口 `1356×1032`。
- 修改后点击 Operation node：DOM 从 `selected=false / data-card-mode=compact` 变为 `selected=true / data-card-mode=compact`；点击后卡片正文保持隐藏，没有误展开。
- 定向浏览器页面仍显示全局侧栏、组件菜单、Canvas 节点和 Agent Panel；本轮未改变组件菜单或运行状态。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- OperationNode.unit.test.tsx NodeCard.unit.test.tsx FileNode.unit.test.tsx FolderNode.unit.test.tsx GitHubProjectNode.unit.test.tsx OutputLocalPathNode.unit.test.tsx OutputProjectPathNode.unit.test.tsx PromptNode.unit.test.tsx
bun run check-types
Pop-Location
bunx oxlint packages/views/src/pages/CanvasPage/OperationNode/OperationNode.tsx packages/views/src/pages/CanvasPage/OperationNode/OperationNode.unit.test.tsx packages/views/src/pages/CanvasPage/NodeCard/NodeCard.tsx packages/views/src/pages/CanvasPage/FileNode/FileNode.tsx packages/views/src/pages/CanvasPage/FolderNode/FolderNode.tsx packages/views/src/pages/CanvasPage/GitHubProjectNode/GitHubProjectNode.tsx packages/views/src/pages/CanvasPage/OutputLocalPathNode/OutputLocalPathNode.tsx packages/views/src/pages/CanvasPage/OutputProjectPathNode/OutputProjectPathNode.tsx packages/views/src/pages/CanvasPage/PromptNode/PromptNode.tsx
git diff --check
```

结果：8 个 test files / 55 tests passed；views typecheck、oxlint、oxfmt 和 `git diff --check` 均 exit 0。

## 40. Phase 5 第四个 slice：Canvas 顶部浮层对齐 Alan TopPill

本 slice 继续以 Alan `WorkspacePage/canvas/chrome/TopPill.tsx` 的布局语义为视觉基准，但不恢复 Alan 的版本状态、旧 Store 或旧运行协议。develop 的保存、设置、状态、运行、Agent Panel 和运行禁用条件继续作为唯一业务来源。

### 实现

- `CanvasTopChrome.tsx`：将标题、Workflow 图标、保存、设置合并为单一紧凑圆角 pill；标题保留 develop 的可编辑 input 和 `handlePipelineNameChange`。
- 右侧保留 `CanvasStatusBar`、运行按钮和 Agent reopen；使用现有 `agentPanelWidth` 计算顶部 chrome 的右侧偏移。
- 标题和按钮增加 `truncate`、`flex-1`、窄视口约束，避免长标题挤压状态/运行控件。
- `CanvasTopChrome.unit.test.tsx` 增加 pill 结构、保存 action、设置/运行 action、运行中禁用和 Agent reopen 断言。

### 9430 / 9440 浏览器证据

- 9430：`http://localhost:9430/canvas?id=pipeline-e2e-1786957641321-0-0`，`1356×1032`；顶部 pill 位于 `x=248,y=12,width=256,height=40`，状态入口 `x=852`，运行入口 `x=928`，右侧 Agent 偏移为 `344px`。
- 9430：`document.scrollWidth=1356`、`clientWidth=1356`，控制台 error 数为 `0`；点击“设置”打开 `Canvas 设置` 对话框，点击关闭恢复 Canvas。
- 9430 窄视口：Luna 已验证 `390×844`，`bodyScrollWidth=390`、`clientWidth=390`，长标题截断且无横向溢出。
- 9440 Alan 对照：同为 `1356×1032` 时显示 Alan 的 `Untitled pipeline` 标题按钮、版本/草稿胶囊和右侧 `状态/运行`；本次只复制其顶部密度和分组关系，未复制其版本状态业务。
- 截图：Playwright 生成 `cod355-topchrome-before-9430.png`、`cod355-topchrome-alan-9440.png`；本轮 After 由 9430 当前浏览器 DOM 几何和交互记录钉证。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- CanvasTopChrome.unit.test.tsx
bun run check-types
Pop-Location
bunx oxlint packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.tsx packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.unit.test.tsx
bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.tsx packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.unit.test.tsx
git diff --check -- packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.tsx packages/views/src/pages/CanvasPage/CanvasTopChrome/CanvasTopChrome.unit.test.tsx
```

结果：1 个 test file / 5 tests passed；views typecheck、oxlint、oxfmt、`git diff --check` 均 exit 0。

## 41. Phase 5 第五个 slice：组件菜单分类文案与 Alan 对照

真实对照确认 9430 与 Alan 的组件面板结构已基本一致，develop 额外的 Skills 与多条 Operation 是业务能力差异，不删除。为消除可见的分类差异，本 slice 只调整中文 Operations 分类文案。

### 实现

- `apps/app/src/locales/zh.json`：`canvas.componentPanel.categories.operations` 从 `Operation` 改为 `工序`。
- `apps/desktop-app/src/locales/zh.json`：同步修改同一 key，保持 Web/Desktop 共享视图的本地化一致。
- `CanvasComponentPanel.tsx`、Store、API、创建/拖拽逻辑未修改。

### 9430 / 9440 浏览器证据

- 9430：`http://localhost:9430/canvas?id=pipeline-e2e-1786957641321-0-0`，`1356×1032`，面板 `x=248,y=100,width=230,height=619`，分类为 `输入对象 / 工序 / 技能 / 输出`，`scrollWidth=clientWidth=1356`。
- 9440：`http://localhost:9440/workspace/pipeline-0fa487e9-c6c8-44ab-8252-6205de938b01`，同视口，Alan 面板 `x=254,y=100,width=230,height=461`，分类文案包含 `工序`。
- 高度差异来自 develop 保留的 Operations 数据和 Skills 分组，不是布局溢出；当前菜单仍支持分类折叠、Operation/Compound/Skill 创建与拖拽。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- CanvasComponentPanel.unit.test.tsx
bun run check-types
Pop-Location
bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check apps/app/src/locales/zh.json apps/desktop-app/src/locales/zh.json
git diff --check -- apps/app/src/locales/zh.json apps/desktop-app/src/locales/zh.json
```

结果：CanvasComponentPanel 1 个 test file / 7 tests passed；views typecheck、oxfmt、`git diff --check` 均 exit 0。Luna 定向 oxlint exit 0。

## 42. Phase 5 第六个 slice：Agent Panel 浮动 shell

真实对照确认 AgentPanel 内容、Composer、runtime 选择和 develop 会话行为已经承接；本 slice 只修正外层空间关系。用户在 `1194×1032` 评论中指出 9430 看起来像“一个面板覆盖在另一个面板上”。DOM 对照证明根因不是 Agent 内容，而是 resize handle 被嵌在 panel region 内：9430 原结构为 1px 有实线 separator + panel，Alan 则为独立的 6px 无实线 gutter，后接单一浮动 panel region。

### 实现

- `CanvasInner.tsx` 将桌面 resize handle 从 panel region 中拆出，放入前置的 `w-1.5`（6px）透明 gutter；`ResizeHandle` 继续复用 develop 的拖拽、键盘与折叠逻辑，但该处设置 `line={false}`，不再画出贴边分割线。
- panel region 只负责 `h-full / overflow-hidden / py-1.5 / pr-1.5`；唯一可见 shell 负责 `rounded-2xl / bg-surface / shadow-float / ring-1 ring-border-strong`，没有第二层背景、边框或阴影。
- `max-[480px]:!w-full` 与窄屏 overlay 保留；390px 下 gutter 为 1px、shell 使用剩余 389px，不改变 Composer 输入和 Agent Panel 内容。
- `agentPanelWidth`、ResizeHandle delta、折叠阈值、Store/API、runtime/session 和运行状态未改变。
- `CanvasInner.unit.test.tsx` 增加 wrapper/gutter/region sibling、6px desktop gutter、无实线 separator 和单一 shell 断言，原有 resize/collapse/keyboard 行为断言继续通过。

### 9430 / 9440 浏览器证据

- 9430，`1194×1032`：wrapper `x=838,width=356`；独立 gutter `x=838,width=6`；region `x=844,width=350`；唯一 shell `x=844,y=6,width=344,height=1020`；`separatorHasLine=false`；`scrollWidth=clientWidth=1194`。
- 9440 Alan，同视口：独立 separator `x=828,width=6`；region `x=834,width=360`；唯一 shell `x=834,y=6,width=354,height=1020`；结构关系、6px gutter、上下/右侧 inset 一致。10px shell 宽度差异来自 develop 的 `agentPanelWidth=344` 与 Alan 默认宽度，不改 develop 状态约束。
- 9430，`1356×1032`：gutter `x=1000,width=6`；shell `x=1006,y=6,width=344,height=1020`；9440 Alan 为 separator `x=990,width=6`、shell `x=996,y=6,width=354,height=1020`；两边均无横向溢出。
- 9430 窄视口：`390×820` 时 wrapper `x=0,y=64,width=390`、gutter `1px`、shell `389px`，`scrollWidth=clientWidth=390`；`1180×820` 断点仍为 absolute overlay，shell `x=836,width=344`，`scrollWidth=clientWidth=1180`。
- Composer 和消息区仍可见，未改变发送、附件、上下文引用或运行内容。
- 截图：`pr-assets/cod-355/agent-panel-9430-1194-current.png`（Before）、`agent-panel-9430-1194-after-gutter.png`（After）、`agent-panel-9440-1194-alan.png`（Alan）、`agent-panel-9430-1194-before-after-diff.png`（Diff）、`agent-panel-9430-1356-after-gutter.png`、`agent-panel-9440-1356-alan.png`、`agent-panel-9430-390-after-gutter.png`。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- CanvasInner.unit.test.tsx
bun run check-types
Pop-Location
bunx oxlint packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.tsx packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.unit.test.tsx
bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.tsx packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.unit.test.tsx
git diff --check -- packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.tsx packages/views/src/pages/CanvasPage/CanvasInner/CanvasInner.unit.test.tsx
Push-Location apps/app
bun run test:e2e -- e2e/canvas.e2e.spec.ts --grep "keeps the Canvas inside 390-1440px viewports"
Pop-Location
```

结果：CanvasInner 1 个 test file / 14 tests passed；Canvas 响应式 Playwright 1 test passed，覆盖 `1440 / 1180 / 981 / 701 / 390`；views typecheck、oxlint、oxfmt、`git diff --check` 均 exit 0。1194px 刷新后标题仍为 `Canvas E2E Pipeline`、2 个节点仍在，page error 和 console error 均为 0。

## 43. Phase 5 第七个 slice：Run Console 当前承接

RunConsole 的 shell 已与 Alan 固定版本保持同一视觉结构，本轮未做无必要的重画：底部浮动、圆角、终端图标、日志计数、状态标签、折叠箭头和关闭入口均一致。develop 额外保留了运行轮询、结构化节点时间线、多输入等待规则、产物发现、错误信息和关闭动作。

### 证据

- 9430 与 Alan 的 RunConsole 源码都使用 `absolute inset-x-3 bottom-16`、`rounded-2xl`、`shadow-float`、终端标题栏和 `h-44` 日志区。
- develop `RunConsole.tsx` 继续读取 develop `activeJobId`、Job、traces、node statuses 和 artifacts，不复制 Alan 旧 `useRunPolling` 状态。
- 当前 9430/9440 Canvas 页面均无活动 Job，因此没有伪造运行态数据；已有 RunConsole Storybook/浏览器证据记录在 §22 和 §36。

### 定向验证

```powershell
Push-Location packages/views
bun run test -- RunConsole.unit.test.tsx
bun run check-types
Pop-Location
bunx oxlint packages/views/src/pages/CanvasPage/RunConsole/RunConsole.tsx packages/views/src/pages/CanvasPage/RunConsole/RunConsole.unit.test.tsx
bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check packages/views/src/pages/CanvasPage/RunConsole/RunConsole.tsx packages/views/src/pages/CanvasPage/RunConsole/RunConsole.unit.test.tsx
git diff --check -- packages/views/src/pages/CanvasPage/RunConsole/RunConsole.tsx packages/views/src/pages/CanvasPage/RunConsole/RunConsole.unit.test.tsx
```

结果：1 个 test file / 8 tests passed；views typecheck、oxlint、oxfmt、`git diff --check` 均 exit 0。本轮没有修改 RunConsole 源码。

## 44. Phase 5 第八个 slice：Canvas 刷新恢复与窄视口回归

本轮没有修改 persistence 或 Store；通过真实浏览器确认当前 develop 的刷新恢复能力在顶部浮层、组件菜单、Agent Panel 和节点数据迁移后仍然成立。

### 9430 浏览器证据

- 桌面 `1356×1032`：刷新前后标题均为 `Canvas E2E Pipeline`，节点数量均为 `2`，组件面板和 Agent shell 均存在，顶部浮层存在；`scrollWidth=clientWidth=1356`。
- 窄视口 `390×844`：刷新后标题仍为 `Canvas E2E Pipeline`，节点数量 `2`，顶部浮层和 Agent shell 均存在；`scrollWidth=clientWidth=390`。
- 两次刷新后的控制台 error 数均为 `0`。
- 9440 Alan 同路由对照仍保持独立参考数据；本轮未修改 Alan 源码或状态。

### 结论

刷新恢复继续以 develop 的 Canvas Store、Pipeline 数据和 Agent 会话逻辑为准；Alan 只用于确认 shell 的空间关系。该项不引入第二套恢复状态，也没有回退 develop 的节点或运行字段。

## 45. Phase 5 第九个 slice：主题、语言与键盘焦点回归

本轮对已经修改的 Canvas shell 做低成本真实回归，不引入新的主题/语言状态。

- 9430 `/settings`：点击“深色”后根节点 class 为 `dark`；点击“跟随系统”后恢复系统模式。
- 9430 设置页键盘：Tab 可以继续移动到页面控件，关键侧栏和设置控件保留可访问名称。
- 9430 Canvas：返回 `http://localhost:9430/canvas?id=pipeline-e2e-1786957641321-0-0` 后顶部浮层、组件菜单、Agent shell 和节点仍可见。
- 主题回归控制台 error 数为 `0`；Alan 9440 仍作为独立固定参考，不修改其主题或状态。

## 46. Phase 5 第十个 slice：侧栏恢复后的对比度回归修复

本轮 acceptance Playwright 首次执行发现恢复 COD-124 侧栏后浅色主题的 `text-muted-foreground` 在 Sidebar 背景上的对比度为 `4.39:1`，影响 Search、New Pipeline、Capabilities 和 Settings，属于本轮侧栏恢复引入的问题。

- `packages/views/src/components/AppSidebar.tsx` 将上述入口文字调整为 `text-foreground/70`，只提高前景对比度，不改变历史壳层布局、Store、路由或交互。
- `AppSidebar.unit.test.tsx` 定向测试：3 tests passed。
- `apps/app/e2e/frontend-acceptance.e2e.spec.ts` 重跑：3 tests passed；主题/语言、键盘/reduced-motion、Pipelines/Canvas serious/critical Axe violations 均通过。
- 迁移侧 acceptance 命令最终 exit 0；该次失败不再作为历史基线保留。

## 47. Phase 5 第十一个 slice：最终构建与 acceptance 结果

- Storybook production build：`bun run build-storybook` exit 0，4206 modules；CanvasTopChrome、CanvasInner、AgentPanel、RunConsole、NodeCard、SemanticEdge 和 EdgeInspector stories 均进入产物。
- Desktop production build：`apps/desktop-app` `bun run build` exit 0，4180 modules。
- Web production build：`apps/app` client 4354 modules、SSR 2209 modules 均构建完成；root `bun run build` 最终 exit 1 是因为 `apps/create` 的 Windows 历史脚本使用 Unix `cp -r`，报 `cp: illegal option -- r`，不在本轮修改文件中。
- Canvas frontend acceptance：`PLAYWRIGHT_PORT=9430 bun run test:e2e -- e2e/frontend-acceptance.e2e.spec.ts` 最终 `3 passed`；包含主题/语言、键盘/reduced-motion 和 Pipelines/Canvas Axe serious/critical=0。
- 迁移 worktree 未提交、推送、合并或删除内容；主 checkout 未由本轮命令修改。

## 48. Phase 5 第十二个 slice：Fresh visual evidence 修复与重建

最终截图审查发现旧 visual spec 的 Alan Canvas route 使用了已失效的固定 pipeline ID，生成的 `canvas-1440x900-alan.png` 实际是 `Pipeline not found`；NodeCard Alan 图还被固定参考 jobs 查询错误 toast 遮挡。两者均属于证据脚本问题，不能作为完成证明。

### 修复

- `apps/app/e2e/alan-migration.visual.e2e.spec.ts`：Alan Canvas 截图改为从 `/pipelines` 真实点击 `New Pipeline`，等待有效 `/workspace/pipeline-*` 和 `canvas-v2-root` 后截图。
- NodeCard 截图在目标 Workspace 导航和节点创建完成后重新注入动态 overlay 隐藏样式，避免参考 harness 的 toast 遮挡节点；不隐藏 Canvas 或 NodeCard 内容。

### 最终结果

- full visual evidence：2 tests passed，约 1.6 分钟；页面 Alan/Before/After/Diff、Canvas 五视口、主题/语言和 NodeCard 证据全部重新生成。
- NodeCard 定向重跑：1 test passed；最新 Alan NodeCard 图显示有效 `Starter prompt` 节点、顶部 chrome、组件入口和 Agent Bar，无错误 toast。
- 最新证据时间为 2026-08-18 14:27；`canvas-1440x900-alan.png`、`canvas-1440x900-after.png`、`canvas-1440x900-diff.png`、五视口 After 和 NodeCard 四联图均非空。
- visual spec 的 oxlint、oxfmt 和 `git diff --check` 均 exit 0。

## 49. Phase 5 第十三个 slice：NodeCard 端口与 SemanticEdge 当前承接

源码和真实页面对照确认端口与连线已经是 Alan 的视觉实现，develop 只扩展了状态来源和边数据语义，本轮不重写。

- 9430 当前节点端口使用 React Flow 的 0×0 handle 加 12px pseudo visual；连接端口真实 DOM 标记为 `data-connected="true"`，输入/输出 aria label 保留。
- 9430 当前 SemanticEdge 使用 2px 状态线和居中 pill label；当前 `数据` 标签与 warning 虚线来自 develop 的 `PipelineEdgeData`，没有引入 Alan 旧 edge 状态。
- 9430 `1356×1032` 页面 `scrollWidth=clientWidth=1356`，edge label 可见，端口 connected/idle 状态可从 DOM 复核。
- 9440 Alan 固定源码的 `NodeCardPorts`/`SemanticEdge` class 与当前 shared 结构一致；Alan 本轮种子数据没有连线，未伪造连接态对照。

定向验证：`NodeCard.unit.test.tsx` + `SemanticEdge.unit.test.tsx` 为 2 个 test files / 21 tests passed；views typecheck、oxlint、oxfmt、`git diff --check` 均 exit 0。本轮没有修改端口或连线源码。

## 50. Phase 5 第十四个 slice：Agent 标题对齐

Fresh Canvas 对照中，develop Agent Panel 头部仍显示 `AI Assistant / AI 助手`，Alan 固定版本显示 `Agent`。该差异只涉及前端文案，不涉及会话、runtime 或运行状态。

- Web/Desktop 的 `canvas.agentPanel.title` 英文和中文值统一为 `Agent`。
- 9430 真实浏览器头部显示 `Agent · 运行时 · runtime-e2e-*`，不再出现 `AI Assistant` 或 `AI 助手`；9440 Alan 同样显示 `Agent`。
- AgentPanel 定向测试 1 file / 20 tests passed；views typecheck、locale oxfmt 和 `git diff --check` 均 exit 0。
- 最终 visual evidence 已在该文案修改后重新生成，`canvas-1440x900-after.png` 可见 `Agent` 标题。

## 51. Phase 5 第十五个 slice：Canvas 空画布文案对齐

- Web/Desktop 空画布标题和描述同步 Alan：英文为 `Start with a node...` 与“连接 inputs、operations、outputs”，中文为“先放一个节点，再把输入、Operation 和输出连接成可运行的 Pipeline”。
- develop 的主按钮仍保留 `Quick add node / 快速新建节点`，继续调用 `handleOpenQuickAdd` 打开现有 Quick Add palette，没有替换为 Alan 的 seed Store 或旧节点创建逻辑。
- 9430 真实点击主按钮后出现 `搜索节点或 Operation...` Quick Add 对话框，Escape 可关闭；9440 新建 Workspace 显示 Alan `Start with a node... / Seed node` 空态。
- 9430 `1356×1032` 真实 DOM：组件面板为 `x=213..443`，空态内容为 `x=490..938`，`overlap=false`；页面 `scrollWidth=clientWidth=1356`。
- `CanvasEmptyState.unit.test.tsx` 3 tests passed；views typecheck、locale oxfmt、`git diff --check` 均 exit 0。
