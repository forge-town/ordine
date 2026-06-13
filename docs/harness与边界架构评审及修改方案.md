# Harness 与模块边界架构评审及修改方案（H 系列）

> 2026-06-12 · 基线：N11–N18 + G3（死交互）完成后的 `refactor/canvas-v2` 工作树 · 审查范围：Agent Bar harness 全链路（前端 → tRPC → proposeActions → agent-engine → runtime 适配器 → pipeline-engine 执行期回路）、包边界、工程化工具链。
> 与既有计划的关系：本方案**收编** `docs/代码治理审查与改动计划.md` 中尚未执行的 G1-04 / G2-01 / G2-02 / G2-04 / G3-01（治理文档的 G3 与 v3 手册的 G3 已撞号，故本方案起用 **H 系列**编号）。
> 状态：**方案，未执行**。开工前按 CLAUDE.md §一 标准逐任务确认。

---

## 一、总体结论

骨架依然健康：分层单向依赖成立、neverthrow 纪律近乎零违例、oxlint 五个自定义规则（含 `ordine-error/no-try`）+ i18n 死键检查已入 quality 门、`proposeActions/` 已按 N11-00 拆出且内部结构清晰（runProposeAgent / parseAgentOutput / buildProposePrompt 职责分明）。新增代码质量明显高于存量。

但 N11–N18 高速施工把三类债务推到了临界点：

1. **Harness 的"统一抽象"是假统一**：`agentEngine` 有注册表的形，但接口契约被 Claude 私有类型穿透，五个 runtime 能力不对等且错误约定不一致；通用 JSON 提取工具寄生在 claude 适配器内被 5 个服务跨域引用。
2. **运行期协议是口头协议**：`@@SELF_HEAL` / `@@USER_ACTION` / `@@NODE_START` 三组魔法字符串在 **6 个文件**各写一份字面量，生产端与解析端零共享定义——这是 N17-03 / G3-03 之后新沉积的最脆弱面。
3. **纪律全靠人记**：CLAUDE.md/CodeGuidelines 的硬规（200 行红线、feature 互 import 禁令、依赖方向）全部机器可查，但仓库没有任何边界守护自动化，也没有 CI——结果是治理文档发布当天红线文件反而从 13 个涨到 16 个。

---

## 二、评审发现（证据级）

### H-A · Harness 层（packages/agent + agent-engine）

**A1 · 接口契约被 Claude 私有类型穿透（核心抽象缺陷）**

- `agent-engine/src/agentEngine.ts:16-19`：统一返回类型 `AgentRunResult { text; events: ClaudeStreamEvent[] }`——通用契约直接引用 claude 适配器的私有事件 schema（:7 从 `@repo/agent` import）。
- 后果链：codex/hermes/openclaw 一律返回 `events: []`（:74,105,116）；`extractTokenTotals`（:127-138）只认 claude 的 `result` 事件 → **token/cost 观测只对 claude-code 生效**，其余 runtime 的用量永远是 null，Usage 页对非 claude 运行是结构性盲区；`buildSpans`（:140-280，全文件 2/3 篇幅）同样只遍历 claude 事件形态。
- 即：DRIVERS 注册表（:119-125）只统一了"怎么调"，没统一"返回什么"。新增 runtime 时观测、用量、span 全部静默降级，无任何类型提示。

**A2 · 错误通道双标**

- `runHermes` 返回 `Result`，agentEngine 将其 `Promise.reject(result.error)`（agentEngine.ts:101-103）；其余 driver 直接 throw；而仓库规范是 neverthrow 全覆盖。harness 内部成了 try/throw 与 Result 的换乘站，调用方（runProposeAgent、Pipeline）各自再包一层 `ResultAsync.fromPromise`。

**A3 · 通用工具寄生在适配器内**

- `extractJsonFromText` 定义于 `agent/src/claude/runClaude.ts:63-76`，却被 5 个跨域消费方引用：`skillsService/createSkillsService.ts:328`、`distillationsService/runDistillation.ts:24`、`skillExecutor.ts:147`、`createPipelinesService.ts:445,544,740`、`proposeActions/runProposeAgent.ts:70-83`。另有第六份变体：`structuredOutput/structuredOutput.ts:22` 自写 fence 正则。"提取 LLM 输出中的 JSON"这一 harness 级关切散布两种实现、六个调用形态。

**A4 · 重试策略三层叠加、四处实现**

- 传输级：`runProposeAgent.ts:32`（MAX_RETRIES 循环）；语义级：`proposeActions.ts:310-324`（semanticRetry 防递归标志）；执行期：`Pipeline.ts:313` self-heal。三层设计本身合理，但 `createPipelinesService.ts:410`（MAX_RETRIES=3）的 generate/analyze/optimize 又各自手写了一份与 runProposeAgent 等价的"调 agent → 提 JSON → zod 校验 → 重试"循环——同一 harness 模式第 4、5、6 份拷贝。
- `agent-engine` 包总共 368 行、单文件，其中 observability 拼装占 240 行；与 `agent` 包的边界（一个是适配器、一个是调度+观测）没有任何 README/类型层面的表达，治理文档 A2 的命名噪声依旧。

### H-B · 运行期协议（魔法字符串）

| 角色 | 位置 | 字面量 |
| --- | --- | --- |
| 生产 | `pipeline-engine/src/pipeline/Pipeline.ts:313,318,400` | `@@SELF_HEAL::` `@@SELF_HEAL_DONE::` `@@NODE_START::` |
| 生产（教执行器输出） | `pipelineRunnerService/promptExecutor/promptExecutor.ts:31` | `@@USER_ACTION::{json}` |
| 解析 | `AgentBar/runSummary.ts:43,54` | `@@SELF_HEAL_DONE::` `@@SELF_HEAL::` |
| 解析 | `AgentBar/userActionRequests.ts:18-19` | `@@USER_ACTION::` `@@NODE_START::` |
| 解析 | `canvas/run/RunConsole.tsx:29` | `@@NODE_START` |

零集中定义、零共享 payload schema（`@@USER_ACTION` 的 JSON 结构只存在于 prompt 文本与解析器注释里）。改一个 marker 或加一个字段需要人肉同步 6 处，且跨 包/前端 边界，编译器全程无感。这与"Zod 唯一真相"原则直接矛盾——trace 协议是目前仓库里唯一没有 schema 的跨边界数据格式。

### H-C · 前端 AgentBar

- `useAgentConversation.ts` **410 行**（红线 2 倍）：发送、phase 状态机、clarify、revise、diagnostics 重发、reversing 两段进度、错误码→i18n 映射、附件 payload 八项职责一个 hook。`AgentBar.tsx` 同为 **410 行**。
- `agentBarStore.ts:55` 仍是模块级 `create()` 单例——G1-04（Provider 工厂化、按 pipeline 隔离）**未执行**，跨 pipeline 消息/徽标闪现的风险面原样保留；`countUnresolvedAnchors` 业务纯函数与 store 同文件。
- 已修复确认：G1-03（canvas→AgentBar 反向依赖）清零；buildAgentContext 单一事实源成立（`context/buildAgentContext.ts`，70 行，Strip 与发送共用）。

### H-D · 服务层与边界存量

- `createPipelinesService.ts` 仍 **769 行**：proposeActions 拆走后，generateStructure / analyzeIntent / optimizeFromDistillation 三条 LLM 流程 + CRUD + 12 个 DAO 装配仍同居——"一拆三不拆"半成品，G2-02 只完成 1/4。
- `dataProvider.ts` **892 行 / 80 case**，G2-01 未动，仍是每个新实体的过路费。
- 巨石文件 >300 行从治理文档时的 13 个**涨至 16 个**（新增 useAgentConversation、AgentBar.tsx 等）；`OperationEditForm.tsx` 1014 行等旧代未动；`apps/app/src/archived/` 444 文件物理仍在 src（vitest/tsconfig 已 exclude，knip 已 ignore——逻辑隔离完成，物理搬迁未做）。
- 包命名噪声原样：`agent`/`agent-engine`、`plugin`/`plugins`、`shared`/`utils`、`views`。
- 正面：包依赖方向实测零反向、services 无直接 `@repo/db` import、schemas 零业务逻辑。

### H-E · 工程化工具链

- **有且良好**：turbo 任务图、oxlint 自定义插件（no-try / no-let / no-use-list-data-fallback 等）、oxfmt、knip 配置（archived/darwin 二进制已 ignore）、`scripts/check-i18n-dead-keys.ts`（134 行，含 --fix，已挂 apps/app quality）、vitest 已 exclude archived、Storybook 88 story、Playwright 配置在位。
- **缺口**：
  1. **CI 形同虚设**：`.github/workflows/ci.yml` 存在，但 ①触发条件是 `branches: [main]`，而 AGENTS.md §五规定 PR 目标为 `develop`——**所有 PR 都不会触发 CI**；②任务只有 check-types + test + build，缺 lint / format:check / check:i18n。另无 pre-commit hook、无 commitlint。"宿主机 quality 全绿"实际完全依赖人工执行，Cowork 沙盒期的"期末集中跑"没有机器兜底。
  2. **零边界守护**：依赖方向、feature 互 import、200 行红线、barrel 规则全部靠 code review；而这些恰是最容易脚本化的规则。
  3. 各包 `quality` 链不一致：apps/app 含 `format:check + check:i18n`；server/services 缺 format:check；**packages/agent 的 quality 无 test**（该包也确实没有任何单测——五个 runtime 适配器零测试）。
  4. prompt 工程无快照基线：buildProposePrompt 等纯函数适合 snapshot，但全仓无任何快照测试，prompt 回归只能靠真模型手测。

---

## 三、处置决策

1. **协议先于重构**：魔法字符串集中化（H1-01）是所有执行期功能的地基，且是纯迁移低风险——排第一。
2. **修契约不推倒 harness**：DRIVERS 注册表保留；改的是 `AgentRunResult` 契约与错误通道，适配器内部实现不动。
3. **抽"结构化 agent 调用"而非抽"prompt 框架"**：四份重复的"调 agent→提 JSON→校验→重试"循环收敛为一个 `runStructuredAgent<T>(schema, prompts, opts)`；prompt 文本本身保持各域手写（现在引入模板框架是过度设计）。
4. **纪律机器化优先于还旧债**：边界守护脚本 + CI 的杠杆率高于继续手拆巨石——先立闸（防新增），再清欠（旧巨石按节奏拆）。
5. **收编不双轨**：H2-03=G1-04、H2-05=G2-02 余量、H3-03=G2-01、H3-05=G2-04、H3-06=G3-01(治理版)。治理文档对应条目执行时以本方案为准。
6. **包合并只出 ADR 不动手**：agent+agent-engine / shared+utils / plugin+plugins 牵涉面大，本轮只写决策记录与 README 职责段，物理合并另行立项。

---

## 四、任务拆分（H 系列，按序执行）

### H1 · 协议与 harness 契约（地基期，全部为低风险高杠杆）

- **H1-01 trace 协议集中化**：新建 `packages/schemas/src/traceProtocol/`——`markers.ts`（`SELF_HEAL` / `SELF_HEAL_DONE` / `NODE_START` / `USER_ACTION` 常量）+ `payloads.ts`（`UserActionPayloadSchema` 等 zod schema）+ `traceLine.ts`（`encodeTraceLine` / `parseTraceLine` 纯函数 + 单测，坏 JSON 容错语义照搬 userActionRequests 现行为）。六个文件（Pipeline.ts:313,318,400 / promptExecutor.ts:31 / runSummary.ts:43,54 / userActionRequests.ts:18-19 / RunConsole.tsx:29）改为引用，**字面量行为零变化**（输出字节级一致，现有解析单测全绿为证）。验收：`grep -rn '"@@' apps packages --include='*.ts*'` 仅命中 traceProtocol 目录与测试。
- **H1-02 extractJsonFromText 归位**：自 `agent/src/claude/runClaude.ts:63-76` 迁出至 `agent/src/json/extractJsonFromText.ts`（含单测：fence 包裹 / 裸 JSON / 前后噪声 / 无 JSON 四例）；`structuredOutput.ts:22` 的 fence 正则变体改用同一函数（若行为差异需先用测试钉住差异再合并）。barrel 导出名不变，5 个消费方 import 零改动。验收：`claude/` 目录不再导出任何非 claude 专属符号。
- **H1-03 AgentRunResult 契约通用化**：`agent-engine` 定义 runtime 无关的 `AgentRunOutcome { text; usage: {input,output} | null; raw?: unknown }`；claude driver 内部把 events 折算成 usage（沿用 extractTokenTotals 逻辑），其余 runtime 诚实返回 `usage: null`；`DriverFn` 返回 `ResultAsync<AgentRunOutcome, AgentRunError>`，消灭 hermes 的 `Promise.reject` 双标（agentEngine.ts:101-103）。`buildSpans` 改为消费 claude driver 附带的 raw events（类型收窄在 claude 分支内部）。验收：tsc 下 `ClaudeStreamEvent` 不再出现在 agent-engine 公开类型；非 claude runtime 跑一条 pipeline，Usage 显示"用量不可用"而非 0。
- **H1-04 runStructuredAgent 通用函数**：在 `packages/services/src/lib/`（或 agent-engine，以依赖方向定）抽 `runStructuredAgent<T>({ runtime, systemPrompt, userPrompt, schema, maxRetries, onProgress })`：调 agentEngine → extractJsonFromText → `schema.safeParse` → 失败重试并注入错误摘要。`runProposeAgent.ts` 改为其薄包装（语义重试逻辑留在 proposeActions）；`createPipelinesService.ts:410-` 起的 generate/analyze/optimize 三份手写循环改调。验收：`extractJsonFromText` 直接调用点 ≤2（本函数 + skillExecutor 评估后处理）；三流程现有单测全绿。
- **H1-05 agent-engine 瘦身 + 职责成文**：buildSpans/recordObservability（agentEngine.ts:140-341）迁至 `agent-engine/src/obs/`（或下沉 `@repo/obs`，以避免反向依赖为准），`agentEngine.ts` 收缩至 ≤120 行（DRIVERS + run）；`packages/agent/README.md` 与 `packages/agent-engine/README.md` 首段写明职责边界（适配器 vs 调度+观测）。纯迁移，单独 commit。

### H2 · AgentBar 与服务层减压

- **H2-01 useAgentConversation 拆分**：410 行按职责拆为 `useSubmitMessage.ts`（发送+attachment payload）、`useProposalLifecycle.ts`（revise/diagnostics/apply 衔接）、`useReversingFlow.ts`（两段进度）、`agentErrorMessages.ts`（错误码→i18n 纯函数+单测）；phase 推进仍全部留在主 hook（v3 手册警告 5 不变）。每文件 ≤200，主 hook ≤200。验收：现有 `useAgentConversation.unit.test.tsx` 不改断言全绿；七阶段真机目检。
- **H2-02 AgentBar.tsx 拆分**：410 行拆出布局壳与派生逻辑（对照 N16/N17 新增的卡片装配段），≤200/文件。纯迁移。
- **H2-03 agentBarStore Provider 工厂化**（=G1-04）：照 workspaceStore 模式 `createAgentBarStore()` + Context，按 pipeline 实例化；`countUnresolvedAnchors` 移至独立纯函数文件。验收：双 pipeline 切换单测（A 写消息→切 B→空→切回 A→还在）；AnchorCountSync 徽标不回归。
- **H2-04 createPipelinesService 续拆**（=G2-02 余量）：`generateStructure/`、`analyzeIntent/`、`optimize/` 各成子目录（prompt 组装独立纯函数文件，复用 H1-04），`createPipelinesService.ts` 收为门面 ≤150 行。迁移与改造分 commit。验收：服务单测全绿；门面行数达标。
- **H2-05 prompt 快照基线**：buildProposePrompt 及 H2-04 拆出的三个 prompt 组装函数补 vitest snapshot（固定输入 fixture），prompt 改动在 diff 中可见。验收：四组 snapshot 入库；改一字 prompt 必挂快照。

### H3 · 边界自动化与存量清算

- **H3-01 边界守护脚本**：`scripts/check-boundaries.ts`——①feature 互 import（`pages/WorkspacePage/canvas` ↔ `AgentBar` 双向 grep）；②services 禁 `@repo/db` 直引；③包依赖方向白名单（读各 package.json，校验 schemas→models→services→app 单向）。`scripts/check-file-size.ts`——非生成/非 vendored 源文件 >300 行警告、>400 行 fail，豁免清单显式注释（sidebar.tsx、routeTree.gen.ts、现存 16 个巨石入"既有债务"白名单防增量）。两者挂入根 quality 链。验收：当前仓库跑通（白名单内全绿）；人为加一条越界 import 即红。
- **H3-02 CI 修通**：改 `ci.yml`——①触发分支补 `develop`（push + pull_request 双向）；②任务链补 `lint + check:i18n + check-boundaries`（format:check 视 oxfmt linux 二进制可用性决定，不可用则记录原因）。不动 release.yml。验收：向 develop 开 PR 自动触发且当前分支绿。
- **H3-03 dataProvider 注册表化**（=G2-01，原计划照执行）：一资源一文件，dataProvider.ts ≤120 行，custom url 常量化。每 3–5 资源一个纯迁移 commit。
- **H3-04 quality 链对齐**：server/services 补 `format:check`；packages/agent 补 vitest（最低限：scanRuntimes 与各 runtime 适配器的 onProgress/参数透传单测，配 mock 子进程）；turbo `lint`/`check-types` 补 outputs 缓存配置。
- **H3-05 archived 物理出 src**（=G2-04）：`apps/app/src/archived` → 根 `archive/app-legacy/`；处理 storybookData 残余引用。
- **H3-06 包图谱 ADR**（=治理版 G3-01）：`docs/adr/001-包合并.md`——agent+agent-engine（H1-05 之后两包边界已清晰，评估合并收益）、shared+utils、plugin+plugins 的合并/保留决策与迁移路径；本期只出文档。

行数预算：traceProtocol 单文件 ≤120；runStructuredAgent ≤150；agentEngine.ts ≤120；H2 全部 ≤200；check-boundaries.ts ≤200。

---

## 五、不动清单

- proposal 校验链（validatePipelineActions / normalizeProposalPayload / catalog 校验）——一行不动。
- DRIVERS 注册表模式、neverthrow 体系、Refine 数据层、buildAgentContext 单一事实源——保留。
- prompt 文本内容（措辞/段落结构）——本方案只动组装位置与测试基线，不改 prompt 语义。
- 三种 store 形态判据（CodeGuidelines §八已成文）——按判据归位即可，不强行统一。
- `views`、双语言运行时迁移机制——不动。

## 六、特别警告区

1. **H1-01/H1-02 是字节级零行为迁移**：trace 输出、JSON 提取结果必须与迁移前完全一致，先以现有单测+新增对照测试钉住，再动 import。迁移与任何"顺手优化"绝不混 commit。
2. **H1-03 禁止伪造用量**：非 claude runtime 拿不到 token 数就返回 null 并在 UI 显示"不可用"，不许填 0 或估算值（假透明原则同 PRD 原则 6）。
3. **H1-04 的重试语义不许漂移**：三层重试（传输/语义/self-heal）的层次与次数上限保持现状，只消灭重复实现，不"顺手"统一次数。
4. **H3-01 白名单是还债清单不是豁免特权**：既有 16 个巨石入白名单仅为防 CI 红，每拆一个从白名单删一行；白名单只减不增。
5. **phase 推进禁扩散**（沿 v3 手册警告 5）：H2-01 拆 hook 时 setPhase 调用点不得离开主 hook。
6. 沙盒环境质量门按 CLAUDE.md §四例外规则执行；H3-02 的 CI 正是该例外的长期解药，优先级不要被压后。

## 七、最终验收清单（H 系列完成定义）

- [ ] `grep -rn '"@@' --include='*.ts*' apps packages` 仅命中 traceProtocol 与测试
- [ ] agent-engine 公开类型零 Claude 专属符号；DriverFn 统一 ResultAsync；非 claude runtime 用量显示"不可用"
- [ ] `extractJsonFromText` 调用点收敛 ≤2；generate/analyze/optimize/propose 共用 runStructuredAgent；四组 prompt snapshot 入库
- [ ] useAgentConversation/AgentBar.tsx/createPipelinesService/agentEngine 全部 ≤200（门面 ≤150/120）
- [ ] agentBarStore Provider 化，双 pipeline 隔离单测绿
- [ ] check-boundaries + check-file-size 入 quality 且 CI 在 PR 上自动执行
- [ ] dataProvider ≤120 行；archived 不在 src；两份包 README 职责段 + ADR-001 合入
- [ ] 宿主机 `bun run quality`（含新闸）全绿；AgentBar 主链路（选中→提案→Apply→Run→USER_ACTION 卡）真机回归通过
