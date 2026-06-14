# N21 · Eval Engineering 缺陷修复施工手册

> 来源：`pr-assets/eval-engineering-壓測记录.md`（2026-06-13 跨主题压测）。本手册把其中**可独立修复、可验收**的缺陷拆成 N21 系列任务，一任务=一 fix commit。
> 纪律遵 `CLAUDE.md`：证据级现状、四要素、行数预算、沙盒过 `tsc --noEmit`（受影响包）+ 写/补单测，vitest/oxlint 期末由用户在宿主机集中跑；末期真机回归。
> 提交格式：`fix: <中文描述> (N21-0x)`。

## 优先级与排序（价值 × 可验证性）

| 任务 | 缺陷 | 严重度 | 类型 | 可沙盒验证 |
|---|---|---|---|---|
| N21-01 | CG-01 / N20-03 cwd 占位路径崩 | 🔴 | 纯函数 | ✅ tsc+单测 |
| N21-02 | SCHED-01 cron 不支持区间/列表（Weekday 预设死） | 🔴 | 纯函数 | ✅ tsc+单测 |
| N21-03 | RUN-03 `@@LLM_CONTENT` trace 重复两次 | 🟠 | 引擎逻辑 | ✅ tsc |
| N21-04 | RUN-05 "root nodes" 文案误导 | 🔵 | 文案 | ✅ tsc |
| N21-05 | LA-01 Local Agent 写死 5 项白名单 | 🔴 | 可扩展化 | ✅ tsc+单测 |
| N21-06 | RUN-06 默认模型地雷 + 缺 key 误标 Network error | 🔴 | 守卫+默认值 | ✅ tsc |
| N21-07 | SCHED-02 scheduler HMR 重复 setInterval | 🔵 | 单例缓存 | ✅ tsc |

## 任务详情

### N21-01 · resolveCwd 展开 `~` 并对不存在路径回退（修 N20-03 + CG-01）
- **现状证据**：`packages/services/src/pipelineRunnerService/resolveCwd.ts:9-22`。已处理"文件→父目录"，但 ①不展开 `~`（`statSync("~/Desktop/x")` 失败）；②`statSync` 失败时仍 `return inputPath`，把不存在的占位路径当 cwd → spawn ENOENT。这正是 N20-03（`~/Desktop/article.md`）与 CG-01（`~/Documents/Code/your-ts-repo` 占位）的崩因。
- **做法**：函数开头把前导 `~`/`~/` 展开为 `os.homedir()`；statSync 成功且是文件→`dirname`；statSync 失败（路径不存在）→回退 `process.cwd()`（不再把无效路径当 cwd）；http(s) 与空值维持原样。
- **验收**：补 `resolveCwd.unit.test.ts`：`~/x.md`→home 下父目录或回退；不存在路径→`process.cwd()`；真目录→原样；文件→父目录。`tsc --noEmit`（@repo/services）。
- **行数**：函数 +~12 行；测试新文件 ~40 行。

### N21-02 · cron 解析支持区间/列表/区间步进（修 Weekday 预设死）
- **现状证据**：`packages/services/src/routineSchedulerService/routineScheduler.ts:33-54` `parseCronField` 仅 `*`/`*/n`/单整数。UI 预设「Weekday 09:00」生成 `0 9 * * 1-5`（真机 zoom 实测），`Number("1-5")=NaN`→`null`→定时静默永不触发。
- **做法**：`parseCronField` 增补：列表 `a,b,c`（逗号拆分，每段递归解析后并集）、区间 `a-b`、区间步进 `a-b/n`。非法仍返回 `null`（保持上层"无效就不调度"）。
- **验收**：扩 `routineScheduler.unit.test.ts`：`0 9 * * 1-5` 在周三应得当日/次日 09:00；`*/5` 仍对；`1,3,5` 命中；越界/乱写仍 null。`tsc`（@repo/services）。
- **行数**：+~20 行；测试 +~25 行。

### N21-03 · 去除 `@@LLM_CONTENT` 终态重复
- **现状证据**：`packages/pipeline-engine/src/nodes/OperationNode/OperationNode.ts`：`handleChunk`(:94-100) 流式节流 emit `encodeLlmContent`，最后一帧 accumulated 常等于全文；随后 :149 / :198 又 emit 一次全文 → trace 重复（job `69235b80` #10=#11）。
- **做法**：`chunkState` 记 `lastContent`；handleChunk 内更新；:149/:198 终态 emit 前 `if (opResult.value !== chunkState.lastContent)` 才发。script 路径无 llmContent 不受影响。
- **验收**：`tsc`（@repo/pipeline-engine）。末期真机 Run 一条 operation，看 JobDetail 不再出现相邻两条相同 `@@LLM_CONTENT`。
- **行数**：+~5 行。

### N21-04 · 修正 "root nodes" 文案
- **现状证据**：`packages/pipeline-engine/src/pipeline/Pipeline.ts:199`：`${rootNodes.length} root nodes in ${levels.length} levels`，实际打印的是总节点数（R1 共 10 节点报"10 root nodes"）。
- **做法**：核对 `rootNodes` 变量语义；若它确为全部节点则文案改 `${nodes.length} nodes`；若确为 roots 则保留但补 total。以代码真实语义为准（读该处上下文后定）。
- **验收**：`tsc`（@repo/pipeline-engine）。
- **行数**：+~1 行。

### N21-05 · Local Agent runtime 目录可扩展（修 Piagent 检测不到）
- **现状证据**：`packages/agent/src/scan/scanRuntimes.ts:12-18` 写死 5 项白名单。Piagent 不在表→永不检测。
- **做法**：① catalog 增 `piagent: "piagent"`；② 支持 env `ORDINE_EXTRA_RUNTIMES`（形如 `name:bin,name2:bin2`）合并进扫描表，使任意自定义 runtime 可被探测（不动 DB，零迁移）。解析做防御（忽略空/缺冒号项）。
- **验收**：补/扩 scan 单测：env 注入额外项后 `scanRuntimes` 会对其 `which`；空 env 行为不变。`tsc`（@repo/agent）。末期真机：装了 piagent 则 Local Agents 页应能检测（取决于用户机）。
- **行数**：+~15 行；测试 +~20 行。

### N21-06 · 缺 KIMI key 快速失败+清晰报错；默认运行时改安全值（修 RUN-06/06b）
- **现状证据**：`settings_table.ts:7-11` 出厂默认 `defaultAgentRuntime="mastra"` + `defaultModel="kimi-for-coding/k2p6"`；`runMastra.ts:43-46` 仅当 apiKey 存在才设 `KIMI_API_KEY`，否则 SDK 抛 "Could not find API key"→UI 误标 "Network error, please try again"。R1 烧 14m/$5.16 才失败。
- **做法**：① `runMastra`（或 providers 入口）开头检查 kimi key：`apiKey` 与 `env.KIMI_API_KEY` 皆空 → 立即返回**清晰可执行错误**（"KIMI_API_KEY 未配置：请在 Settings 配置 Kimi API Key，或将该算子运行时改为 claude-code"），不再进 SDK、不再 14 分钟空烧。② schema 出厂默认改安全值：`defaultAgentRuntime` `"mastra"`→`"claude-code"`、`defaultModel` 置空串（仅影响新装；现有单行 settings 不强改，避免动用户数据——清晰报错已给出手动切换指引）。
- **验收**：`tsc`（@repo/agent + @repo/db-schema）。逻辑：无 key 路径返回 error 而非抛 SDK 异常。末期真机：把某算子留默认运行时并无 key 时 Run，应秒级失败且 JobDetail 显示新文案而非 "Network error"。
- **行数**：runMastra +~10 行；schema 改 2 行。
- **注意**：不写数据迁移强改用户既有 settings 行（红线：不擅动用户数据）。

### N21-07 · scheduler 单例缓存避免 HMR 重复 setInterval
- **现状证据**：`apps/app/src/integrations/trpc/services.ts:42-51` 模块作用域 new service 并 `.start()`；HMR 重新求值会再 new + 再 `setInterval`，旧 interval 未清→叠加（同 INFRA-01 的 db 重开类问题，db 已 globalThis 缓存，scheduler 未）。
- **做法**：仿 INFRA-01，把 routineSchedulerService 实例（或其 interval 句柄）缓存到 `globalThis`，HMR 复用同一实例、不再重复 start。
- **验收**：`tsc`（@repo/app 受影响处）。末期真机：连续改 services 触发多次 HMR，确认不产生重复 routine 触发。
- **行数**：+~8 行。

## 暂不在本期（较大/需产品决策，登记遗留）

- **CONN-01 Connector 真实化**：需实现 MCP client（握手/拉 tool/落 config/lastSyncAt）+ 执行器注入 + 安全凭据存储 + Add/Manage 增连接配置字段。体量≈一个独立 N 期，单列。
- **RUN-01 算子输出契约**：同模板节点输出 JSON 形状各异；治理需在算子 system prompt 强约束单一 schema 或在合并端规整，效果需真模型回归，单列。
- **RUN-02 算子写盘越权**：算子擅写 `~/Desktop`；需执行器约束写盘范围 + 校验声明 output 存在，涉及 agent 工具权限，单列。
- **RUN-04 token 成本**：fetch 算子输入 21 万 token，需排查 context 组装，单列。
- **OBS-02/03、RUN-05 余项**：UI 保存态文案、Apply 按钮命中区，UX 小修，择机。

## 最终验收清单（N21 合并前）

- [ ] N21-01..07 各自 `fix: … (N21-0x)` 单 commit，沙盒 `tsc --noEmit` 受影响包全绿
- [ ] 新增/扩充单测：resolveCwd、cron range、scan extra-runtime
- [ ] 真机回归：① Weekday 预设建定时→`nextRunAt` 不再为 null（SCHED-01）；② 占位/`~` 路径 Run 不再 ENOENT（cwd）；③ 缺 key Run 秒级失败+新文案（RUN-06）；④ operation Run trace 无重复 LLM_CONTENT（RUN-03）
- [ ] vitest/oxlint/oxfmt 由用户在宿主机集中跑，问题以 fix 补齐
