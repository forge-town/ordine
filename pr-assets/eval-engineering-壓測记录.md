# Eval Engineering · Ordine 系统压测与缺陷记录

> 开始：2026-06-13。本轮目标：用 Agent Bar 大量、跨主题地生成 pipeline（资料查询 / 信息整合 / 代码生成 /
> 自动化等），尽量把 Schedule、Jobs、Skill、Connector、Local Agent 组合起来，逼系统到极限，
> **记录所有漏洞、Bug、可疑行为**，供后续统一修复。本文件只记录与归类，不在本轮逐个修复。
>
> 判定记号：🔴 阻断级（功能不可用/崩溃） · 🟠 缺陷（行为/数据错误） · 🟡 体验/健壮性 · 🔵 观察/待确认 · ✅ 正常确认

## N21 修复批次结果（2026-06-13，手册 `docs/eval-bug修复手册-N21.md`）

每修一个一个 fix commit，沙盒 `tsc --noEmit`（受影响包）全绿 + node strip-types 冒烟；vitest/oxlint 期末由用户在宿主机集中跑。

| 缺陷 | commit | 处置 | 验证 |
|---|---|---|---|
| CG-01 / N20-03 cwd | `21beb27` (N21-01) | resolveCwd 展开 `~`、不存在路径回退 `process.cwd()`、文件取父目录 | 冒烟 8/8 |
| SCHED-01 cron 区间 | `f135667` (N21-02) | parseCronField 支持 `a-b`/`a,b`/`a-b/n` | 冒烟 7/7（含 Fri→Mon 跳周末）+ **真机**：Weekday 预设 `0 9 * * 1-5` 建出 routine，弹窗显示「Runs Mon–Fri at 09:00」、进 Scheduled 列表（旧实现此处静默失效）✅ |
| RUN-03 trace 重复 | `08f7432` (N21-03) | 终态 LLM_CONTENT 与流式末帧去重 | tsc |
| RUN-05 文案 | `785d556` (N21-04) | "root nodes"→"top-level nodes" | tsc |
| LA-01 runtime 白名单 | `b72a288` (N21-05) | 加 piagent + `ORDINE_EXTRA_RUNTIMES` 扩展 | 冒烟 + tsc |
| RUN-06 默认模型/报错 | `d84d267` (N21-06) | 缺 KIMI key 秒级清晰报错；出厂默认 runtime→claude-code（仅新装） | 守卫冒烟 4/4 + tsc |
| SCHED-02 HMR 重复 interval | `f3d8ccb` (N21-07) | globalThis 标志保证 scheduler 只 start 一次 | tsc |

**真机回归**：上述后端改动全部 HMR 进运行中的 app，`/pipelines`、`/jobs` 正常无 500——INFRA-01 在这批改动下仍稳。
**未在本期（登记遗留，见手册）**：CONN-01（需实现 MCP client，体量≈一个 N 期）、RUN-01/02/04（算子输出契约/写盘越权/token 成本）、OBS-02/03 UX 小修。

---

## 0. 环境与前置修复

| 编号 | 现象 | 根因 | 处置 |
|---|---|---|---|
| ENV-01 | `restart-dev.command` 双击后 dev 立即崩，`localhost:9430` connection refused | 脚本跑根 `bun run dev`（`turbo run dev`），会连带启动 `@ordine/cli`、`@ordine/create` 两个一次性 CLI（`bun src/index.ts` → 打印 help 后 `exit 1`）。turbo 把它们当持久任务、其失败拉崩整窝 dev（含 app vite）。 | 改 `restart-dev.command` 末行为 `bun run dev --filter=@ordine/app`，只起 app vite。✅ 已修，app 正常起于 :9430 |
| INFRA-01 | 改 `packages/services` 必崩全路由 500（历史顽疾） | `db.ts` 顶层 `await createDb()` 每次 HMR 重新求值都 `new PGlite(dataDir)` 抢文件锁 | `db.ts` 把首个连接 promise 缓存到 `globalThis`（commit `767e89fe`）。本轮两次改 services → 触发 SSR HMR，Jobs/Pipelines 路由均正常重渲、无 500。✅ 闭环验证通过 |

## 1. 压测用例与发现（按主题）

> 每条用例记录：输入指令 → 提案表现 → Apply → Run → 结论/缺陷。

### 1.1 资料查询 / 信息整合

**用例 R1 —「AI 芯片竞品周报」**（空画布）
输入：每周一抓取 NVIDIA/AMD/Google TPU 最新动态 → 去重整合中文 Markdown 简报（附来源链接）→ 导出到 `~/Desktop/ai-chip-weekly`。
- 提案：真模型给出 **19 graph actions**，DAG 拓扑正确：3×prompt → 3×fetch operation → 去重整合 → 润色并自审校（**loop ×3**）→ 导出 → output-local-path。扇入合并再线性，边连接全对。✅
- ✅ Apply 后 N19-01 自动命名生效：TopPill「Untitled pipeline」→「AI 芯片竞品周报」。
- ✅ N20 loop 徽标在提案卡（loop ×3）与画布节点（「Loop · max 3」）双端渲染。
- ✅ 模型诚实声明：现有算子无「网页抓取 / 跨源去重整合」专用算子，故新建三个 `op_new_*`；并主动提示「每周一定时触发需在流水线设置里配置 cron，节点本身先把内容链路搭好」——不假装自己能配定时。

观察/疑点：
- 🟢 **OBS-01（已真机修正）web-fetch 能力依赖运行时，claude-code 实测可联网真取数**：Run R1 后查 JobDetail trace（job `69235b80`），三个 fetch operation 由 `claude-code` 执行，**真返回了本周真实、带来源 URL 的新闻**（NVIDIA Newsroom、AMD Blogs、DigiTimes、Yahoo Finance、The Information 等，日期 2026-06-06~06-13，每节点 4.5~5.6k 字、35~59 events）。所以系统虽无 fetch 算子原语，但 claude-code runtime 自带联网检索→「资料查询」类 pipeline 在该 runtime 下可用且非编造。**遗留**：能力隐式依赖 runtime，换 hermes/codex 等无联网 runtime 则会静默退化为编造，建议提案此类节点时标注「依赖运行时联网」或提供显式 fetch 算子。

**R1 Run 真机 trace（job `69235b80`）发现：**
- ✅ cwd 健壮（与 N20-03 互补）：无输入文件夹的 operation，执行器 cwd 默认落到 `…/Ordinctor-fork/apps/app`（sane），未复现 N20-03 的 `~/Desktop` 占位 cwd 崩溃——那个 bug 只在输入节点显式塞占位路径时触发。
- 🟠 **RUN-01 同模板兄弟节点输出 JSON 形状各异，无 schema 约束**：三个 fetch operation 用同一 operation 定义，却吐出**三种不同结构**：① `{result:"<stringified JSON>", outputs:[路径]}`；② `{outputs:{result:路径}, result:[数组]}`；③ 裸 `[数组]` + markdown「Sources:」段 + 再包一个 `{outputs:{result:"见上方…"}}`。下游「去重整合」节点因此收到 3 种异构 blob。operation 输出契约未强制，全凭 LLM 自由发挥→ 合并/解析脆弱。建议：operation 输出按声明的 `contentType`/schema 校验或规整。
- 🟠 **RUN-02 算子擅自"写文件到 ~/Desktop"——副作用泄漏或路径造假**：fetch 节点本只该产出数据（导出是独立 final 节点的事），但它们在 `outputs` 里自填 `/Users/alanyu/Desktop/nvidia_ai_chip_news_*.json`、`google-tpu-news-*.md` 等路径。要么 claude-code 真的越权往 ~/Desktop 写了文件（非流水线设计的副作用），要么纯属编造的输出路径（撞不伪造）。二者都需治理：执行器应约束算子的写盘范围、并核验声明的 output 文件真实存在。
- 🟠 **RUN-03 @@LLM_CONTENT trace 重复**：每个节点的 `@@LLM_CONTENT::node_*` 日志整段**输出两次**（trace #10=#11、#16=#17、#22=#23）。日志/trace 去重缺失，既占存储又会让 JobDetail 体积翻倍。
- 🟡 **RUN-04 输入 token 异常高**：三个 fetch op 的 prompt-executor 计 213857 / 110601 / 132145 **输入** token（→ 17897/12852/10865 输出）。"抓条新闻"的输入 21 万 token 明显偏高，疑似 system/context 累积或把整段历史塞进去，成本敏感场景需排查。
- 🔵 **RUN-05 文案**："Pipeline loaded. 10 root nodes in 6 levels" —— 实为 10 个**总**节点（3 prompt+6 op+1 output），非 10 个 root。措辞误导。
- 🔴 **RUN-06（本轮最重要的运行 bug）整条 run 终态 Failed，根因是某节点用了没配 key 的模型 `kimi-for-coding/k2p6`**：JobDetail 头部红条：`Network error, please try again` / `Could not find API key process.env.KIMI_API_KEY for model id kimi-for-coding/k2p6`。5 个 claude-code agent run **全部成功**（fetch 真取到数据），但后段节点（润色/loop 节点 `node_op_polish`）被指派到 **Kimi 模型** `kimi-for-coding/k2p6`，而环境无 `KIMI_API_KEY` → 终态失败。Duration 14m21s、Cost **$5.16** 全部白烧。
  - 🟠 **误导文案**：错误标题写 `Network error, please try again`，实为**缺 API key 的配置错误**，且"try again"无意义（确定性失败，重试必再失败）。应分类为 config/credential 错误并给出"去 Settings 配置 KIMI_API_KEY 或改用 claude-code"的可执行指引。
  - 🟠 **同流水线节点模型分配不一致**：fetch 三节点跑在 `claude-code`，polish/loop 节点却落到 `kimi-for-coding/k2p6`。Agent 新建的 operation 默认模型来源不统一，部分指向无 key 的模型→ 必崩。需排查 new op 的默认 executor/model 来源，并在 Run 前校验所选模型的凭据是否就绪（缺则提前拦截，而非烧完 14 分钟才报错）。
  - 🟠 **缺终态保护/无自愈兜底**：上游 5 步成功的产物因末步失败被整体判 Failed、$5.16 沉没；self-heal 对"缺 key"这种非瞬时错误无能为力（合理），但引擎应支持**断点续跑/保留已成功节点产物**，避免昂贵重跑。
  - **证据级根因（已定位）**：`packages/db-schema/src/tables/settings_table.ts:11` 把 `defaultModel` 的 **DB 默认值硬编码为 `"kimi-for-coding/k2p6"`**；`packages/services/src/operationRunnerService/createOperationRunnerService.ts:105` 用 `settings.defaultModel` 作算子模型；`packages/agent/src/mastra/runMastra.ts:46` 中 Kimi 模型需 `KIMI_API_KEY`（`env` schema 里是 optional，通常未配）。**即：任何未显式锁定 runtime 的 operation 都会回落到 Kimi 默认模型 → 没 key → 必崩。** 全新/默认环境下这是地雷。修复：把默认模型改为环境里已就绪的 runtime（如检测到的 claude-code），或在缺 key 时 Run 前校验拦截并提示；至少不把需要外部 key 的模型设成出厂默认。
- 🔵 **OBS-02 Apply 后保存态不一致**：Agent 文案「Applied the proposal and saved the pipeline.」，但 TopPill 同时显示「v1 · unsaved」。疑似自动保存防抖与文案时序不一致，需确认是否真落库。低优。
- 🟡 **OBS-03 Apply 按钮点击不跟手（易复现）**：提案动作列表很长需滚动，Apply 按钮随面板滚动改变绝对位置；前两次点击「Apply」未触发（坐标落到 Context 条/空白），第三次命中才 Apply。对自动化/无障碍不友好；按钮宜常驻吸底或扩大命中区。

### 1.2 代码生成 / 复杂多节点

**用例 C1 —「TS 工具函数补单测流水线」**（空画布）
输入：读 TS 仓库 → 找缺单测的工具函数 → 各生成 vitest 单测 → 跑测试，失败自动改代码重试（≤3 轮）直到全绿 → 出覆盖率提升报告导出本地。
- 提案：真模型 **11 graph actions**，5 节点：folder → 扫描缺测函数(new op) → 生成 vitest 单测(new op) → 跑测试自动修复(new op **loop ×3**) → 覆盖率报告(new op) → output-local-path。线性链路正确。✅
- ✅ 模型把"失败重试最多 3 轮"准确映射成 `loopEnabled + maxLoopCount=3 + loopConditionPrompt`（N20 loop 的标准用法），loop 徽标在该节点正确渲染。
- ✅ Apply 一次成功，自动命名「TS 工具函数补单测流水线」。
- 🟡 **CG-01（复证 N20-03 cwd 遗留，且是高频触发）**：folder 输入节点被模型塞了**占位路径** `~/Documents/Code/your-ts-repo`（不存在）。若用户不改直接 Run，operation 的 cwd 取自此占位路径 → `~` 未展开、目录不存在 → spawn 失败（同 N20-03）。说明"提案塞占位路径 + cwd 不健壮"是会反复咬人的组合。建议：① Run 前若存在未填/占位的 input slot 应拦截并提示填真实路径；② cwd 解析展开 `~`、校验存在性、不存在则报清晰错误而非 ENOENT。
- 未 Run（占位路径必失败 + 真模型耗时），提案+Apply 链路已验证。

### 1.3 Schedule / Jobs / Skill / Connector 组合

**🔴 CONN-01 — Connector 是与执行完全脱节的 CRUD 空壳，"Connected" 是假状态。**

- 真机：Connectors 页 → Add Connector 只收 **Name / Method(MCP) / Scopes** 三项，**没有任何"连到哪"的字段**（无 server URL / command / endpoint / token）。建出 `github-mcp` 后点 **Connect**，状态瞬间从 `Needs setup` 翻成绿色 `Connected`——零握手、零鉴权。Manage 弹窗里 `Status` 干脆是个可手选下拉（Connected/…）。
- 证据级根因：
  - `packages/db-schema/src/tables/connectors_table.ts` 有 `config jsonb` 与 `lastSyncAt`（本是为真连接设计的），但 UI 从不收集 `config`，`lastSyncAt` 永不写。
  - 全仓 `services` / `agent` / `agent-engine` **grep 不到任何 MCP client / transport / spawn / connect 逻辑**——根本没有"连接 MCP server / 拉取工具"的代码。
  - `connectorsDao` 只被它自己的 DAO 与 `daos/index` 引用；`pipeline-engine` / `agent-engine` **从不读取 connectors**。即 connector 与流水线执行完全无关。
- 影响：页面副标题承诺"expose tools and external systems to local agents"，但**没有任何工具被暴露**；"Connected" 会误导用户以为 GitHub 等工具已在 pipeline 可用（实际 Run 时执行器根本不看 connectors）。撞「不伪造」红线。
- 修复方向：① Add/Manage 增加真实连接配置（MCP server command/url + 凭据，凭据走安全存储而非明文 jsonb）；② 真正实现 MCP client：Connect 时握手、拉 tool 列表写入 `config`、置 `lastSyncAt`，失败则保持 needs_setup 并报错；③ 执行器在组装 executor 时按 operation 需要注入 connector 暴露的工具；④ 在②前，UI 不应提供"手选 Connected"，且 Run 路径要能消费 connector，否则就是装饰。
- 备注：本轮创建的测试 connector `github-mcp` 为压测残留数据，未删除（遵守不擅自删用户数据）。

**✅ SKILL 导入 — Preview Import 是真功能（与 connector 空壳形成对照）。**
- 真机：Skills 页输入文件夹路径 `…/Ordinctor-fork/skills` → Preview Import → 真实扫描出 **19 个可导入 skill**（Ordine Browse Filesystem / Create Operation / Run Pipeline …），每张卡片含从 SKILL.md 解析出的中文描述 + 触发词，全部 Selected，出现「Import 19」按钮。说明导入流真读目录、真解析。未实际点 Import（避免污染工作区），Preview 已足证功能在线。
- 🔵 OBS-04：内置 12 个 skill 全是 dev 向 best-practice（page/store/dao/service/form/schema…），每个"powers X Operation"。面向"资料查询/信息整合/通用自动化"场景的 skill 缺位——压测这类 pipeline 时没有可复用 skill 支撑（不算 bug，是内容覆盖面观察）。

**✅ SCHEDULE 后端真实在线（与 connector 空壳形成强对照）。**
- 证据：`createRoutineSchedulerService`（`packages/services/src/routineSchedulerService/createRoutineSchedulerService.ts`）`setInterval(tick, 30_000)` 真轮询；`apps/app/src/integrations/trpc/services.ts:51` 调 `routineSchedulerService.start()` 启动。`tick()`（routineScheduler.ts:108-134）找到 `nextRunAt<=now` 的 enabled cron routine → `startRun({triggeredBy:"routine"})` → 回写 `lastRunAt`/`nextRunAt`。链路完整。

**🔴 SCHED-01（真机确认，升级为阻断级）— 内置「Weekday 09:00」预设生成 `0 9 * * 1-5`，而 cron 解析器不支持区间 `1-5`，导致该预设建出的定时任务静默永不触发。**
- 真机复证：New Routine → 选 pipeline → Schedule 标签页 → 点 **PRESETS「Weekday 09:00」** → CRON 构建器 WDAY 格变成 **`1-5`**（zoom 实测）。这正是下方解析器吃不下的区间表达式——**UI 给的预设和后端解析器自相矛盾**。用户点最自然的"工作日"预设，得到一个"已启用却永不运行"的死定时，无任何报错。
- 解析器细节：`routineScheduler.ts:33-54` `parseCronField` 仅处理 `*` / `*/n` / 单整数；`"1-5"`→`NaN`→`null`→`getNextCronRunAt` 返回 `null`→`tick` `if(!scheduledAt) continue` 静默跳过。原 SCHED-01（理论）↑ 现已被内置预设实锤。
- 证据：`routineScheduler.ts:33-54` `parseCronField` 仅处理 `*`、`*/(\d+)`、`Number(field)` 单值；`"1-5"`→`Number("1-5")=NaN`→返回 `null`→`getNextCronRunAt` 整体返回 `null`→`tick` 里 `if(!scheduledAt) continue` **静默跳过**。
- 影响：最常见的"工作日 `0 9 * * 1-5`"、"周一三五 `0 9 * * 1,3,5`"这类表达式会**静默永不触发**，且无任何报错/UI 提示。用户以为定时配好了，实际从不跑。
- 修复方向：parseCronField 增补 range（`a-b`）、list（`a,b`）、range+step（`a-b/n`）解析；或直接换成成熟 cron 库；非法/不支持表达式应在保存时校验并报错，而非运行时静默 null。

**🔵 SCHED-02 — scheduler 在模块作用域启动，HMR 可能累积重复 setInterval。**
- `services.ts:51` 的 `.start()` 在模块求值时执行。INFRA-01 只缓存了 db，未缓存 scheduler 服务实例；services 热重载重新求值 → 可能 new 出新 service + 新 `setInterval`，旧 interval 未清→定时器叠加（dev 期偶发重复触发）。低优，建议同样 globalThis 缓存 scheduler 单例或在模块卸载时 stop。

### 1.4 Local Agent 检测

**🔴 LA-01 — "自动检测"实为固定 5 项白名单，Piagent 等任何不在表内的 runtime 永远检测不到。**

- 现象：Local Agents 页底部文案 `Auto-detected 3 of 5 agent runtimes on localhost`，列出 codex / claude-code / hermes 三个 Connected。用户本地装了 **Piagent** 却始终不出现。
- 根因（证据级）：`packages/agent/src/scan/scanRuntimes.ts:12-18` 写死了一张表：
  ```ts
  const RUNTIME_BINARIES = {
    "claude-code": "claude", codex: "codex", hermes: "hermes",
    mastra: "mastra", openclaw: "openclaw",
  };
  ```
  `scanRuntimes()` 只对这 5 个名字逐个 `which <binaryName>`（:82-89）。"3 of 5" = 这张固定表里 3 个 `which` 命中。**piagent 根本不在表里 → 无论是否安装、装在哪，都不会被扫描到。** 这不是"自动检测环境"，是"检测这 5 个已知 CLI 是否存在"。
- 次要风险（同处）：检测用 `which` 跑在 dev server 的 PATH 下（`restart-dev.command` 仅注入 `~/.bun/bin:/opt/homebrew/bin:/usr/local/bin`）。即便某 runtime 在表内，但装在别处（pyenv/conda/nvm 前缀、用户交互式 shell 的 rc 里才有的 PATH），子进程 `which` 也找不到 → 误判"未安装"。
- 修复方向：① 把 piagent 加进 catalog（治标）；② 根治：catalog 改为可扩展——配置驱动（settings 里维护 runtime 列表）或允许用户登记"自定义 runtime + 二进制名"；③ 扩大 PATH 探测（读用户登录 shell 的 PATH，或允许填绝对路径）；④ UI 文案别再写"Auto-detected"暗示全环境扫描，改为"已知 runtime 探测"或提供"添加自定义 runtime"入口。

## 2. 缺陷清单（汇总，供统一修复）

按严重度排序。详情见上文对应条目。

| # | 模块 | 判定 | 一句话 | 证据 |
|---|---|---|---|---|
| RUN-06 | 引擎/模型 | 🔴 | 出厂默认模型 `kimi-for-coding/k2p6` 需 `KIMI_API_KEY`（通常没配），任何未锁 runtime 的算子回落到它必崩；错误还误标成"Network error"。R1 烧 14m/$5.16 后整体 Failed | `settings_table.ts:11` 默认值；`operationRunnerService.ts:105`；JobDetail 红条 |
| CONN-01 | Connector | 🔴 | Connector 是与执行脱节的 CRUD 空壳，无连接目标字段，"Connect"只翻状态，执行从不读 connectors | `connectors_table` 有 config/lastSyncAt 但无 MCP client 代码；engine 不引用 connectorsDao |
| LA-01 | Local Agent | 🔴 | "自动检测"是写死的 5 项白名单（claude-code/codex/hermes/mastra/openclaw），Piagent 等不在表内永远检测不到 | `scanRuntimes.ts:12-18` |
| SCHED-01 | Schedule | 🔴 | 内置「Weekday 09:00」预设生成 `0 9 * * 1-5`，解析器不支持区间 `1-5` → 该定时静默永不触发 | UI 预设 zoom 实测 `1-5`；`routineScheduler.ts:33-54` |
| RUN-01 | 引擎 | 🟠 | 同模板兄弟算子输出三种异构 JSON 形状，无 schema 约束，下游合并脆弱 | job `69235b80` trace #10/16/22 |
| RUN-02 | 引擎/安全 | 🟠 | 算子擅自往 `~/Desktop` 写文件/填造路径，写盘范围无约束、output 未校验存在 | trace `outputs:[~/Desktop/*.json]` |
| RUN-03 | trace | 🟠 | `@@LLM_CONTENT` 日志每条重复输出两次 | trace #10=#11 等 |
| RUN-06b | 引擎 | 🟠 | 错误文案误导（缺 key 报"Network error, try again"）+ 同流水线节点模型分配不一致 + 无断点续跑、贵重产物随末步失败全废 | JobDetail |
| CG-01 | 提案/引擎 | 🟡 | 提案给 input 节点塞占位路径（`~/Documents/Code/your-ts-repo`），Run 前不校验 → cwd 无效 ENOENT（同 N20-03） | C1 提案 |
| RUN-04 | 成本 | 🟡 | fetch 算子输入 token 高达 21 万，疑 context 累积 | Agent Runs 计数 |
| SCHED-02 | Schedule | 🔵 | scheduler 模块作用域启动，HMR 可能累积重复 setInterval | `services.ts:51` |
| OBS-01 | 能力 | 🟡 | 无 fetch 算子原语，资料查询全靠 runtime 自带联网（claude-code 实测 OK，换无联网 runtime 则静默编造） | R1 trace |
| OBS-02 | UI | 🔵 | Apply 后 Agent 说 saved，TopPill 仍 unsaved | R1 Apply |
| OBS-03 | UI/无障碍 | 🟡 | Apply 按钮随长列表滚动改位，点击不跟手 | R1 Apply ×3 |
| RUN-05 | 文案 | 🔵 | "10 root nodes" 实为 10 总节点 | trace #58 |

## 3. 正常确认 / 误报撤销（诚实标注）

- ✅ **Agent Bar 提案主链路稳**：两条迥异主题（资料周报 R1 / 代码补测 C1）真模型都给出拓扑正确、19/11 actions 的提案；Apply 落库、N19-01 自动命名、N20 loop 徽标三端一致——核心能力扎实。
- ✅ **claude-code runtime 真联网取数**：R1 fetch 节点返回本周真实带 URL 新闻，非编造（撞「不伪造」的担忧在该 runtime 下不成立）。
- ✅ **Schedule 后端真实**（setInterval→tick→startRun 链路完整）、**Skill 文件夹导入真实**（Preview Import 真扫真解析 19 个）、**INFRA-01 热重载根治验证通过**、**ENV-01 重启脚本已修**。
- ✅ **cwd 默认健壮**：无输入文件夹的算子 cwd 落到 `apps/app`，未复现 N20-03 崩溃（该崩溃仅占位路径触发）。
- 📌 **残留测试数据**：本轮创建 connector `github-mcp`、pipeline「AI 芯片竞品周报」「TS 工具函数补单测流水线」及 R1 的失败 job，均为压测产物，未清理（遵守不擅自删用户数据）。
