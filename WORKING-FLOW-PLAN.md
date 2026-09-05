# ORDINE 唯一执行计划：让对话真正变成可运行的 Pipeline

本文件取代本轮 ownership、DSH 和补覆盖率导向的执行清单。只推进一个结果：用户的任务经过真实模型执行，变成可打开的文件。[COD-390](https://linear.app/code-forge-official/issue/COD-390) 跟踪这份唯一计划：修通对话 → Pipeline → 真实执行 → 文件交付。

## 要交付的结果

用户从首页发出一个带输入文件的任务，进入工作区，选择真实可用的 runtime/model，生成并确认 Pipeline，运行后得到实际文件；刷新页面后能继续看到同一条 Pipeline、Job、Agent Run 和执行结果。Codex 通过 ORDINE MCP 能操作并回看同一条链路。

固定交付样例：读取工作目录里的 `notes.md`，第一步由真实 LLM 提取摘要并写入 `summary.md`，第二步读取这个文件、生成 `final.md`，输出节点展示最终文件。输入包含本轮独有的标记；第一步再生成一个新的交接标记写入 `summary.md`，第二步必须从该文件取到并保留两个标记。结合文件读取/写入的工具事件核对传递过程，不能只凭模型的成功回复判断完成。

## 顺序执行，只修阻断这条链路的问题

1. **续接已有实现并启动环境。** 继续使用 `.worktrees/streamline-runtime-tests`，保留当前删减；基线固定为 `7f63ac3d4fb065ba1cf41a6d73ed614c484b63e1`。先审阅、接入已有 `fix/pipeline-runtime-reliability@c1f97be4` 中的运行配置传递、首输出超时、用户补充信息被误判成功、结构化结果与文件输出修复。这批实现已存在于旁边的工作树，本轮尚未合入，不能当作当前版本已有行为。然后按 [源码启动说明](./README.zh-CN.md#方式二--从源码开发) 启动 PostgreSQL、Server、Web，三者使用同一独立数据库，配置独立工作目录和空闲端口。记录实际 commit、runtime 绝对路径/版本、模型及 reasoning/speed 配置。先用一套实际可调用的 Codex runtime 跑主链路；发现配置未传递、登录失败或服务连不上，就修该入口。
2. **把对话落成可执行 Pipeline。** 在首页选择 runtime/model 并提交任务，进入工作区，处理澄清、确认提案，再生成 Canvas。逐段检查 `pipelineAgentSessionsService`、`pipelinesService`、Operation registry 和 Canvas 持久化。每个 Operation 保存可执行配置，文件输入/输出连线正确；刷新后图和选择仍在。直接修导致空图、丢配置、找不到 Operation 或无法运行的实现。
3. **运行并拿到文件。** 从 Canvas 启动这条 Pipeline，沿 `pipelineRunnerService → pipeline-engine → agentRunsService → runtime adapter` 修通执行。第一步真实调用模型并写文件，第二步消费第一步产物；Job、节点和 Agent Run 进入一致终态。读取产物内容并记录 SHA256，不以模型声称写了文件或仅返回文本作为完成证据。
4. **让用户看得懂、接得上。** 执行中显示文本、工具活动和节点状态；刷新后从持久事件恢复，不能重复启动任务。再取消一次正在执行的任务，并制造一次可诊断的工具失败，修好仍显示 Running、取消后继续执行、原始错误丢失或缺少输入却显示成功的问题。沿同一条任务修复；每修一个阻断就从该步骤继续，最终在同一版本完整跑通一次。
5. **从真实 Codex 会话接通 MCP。** 使用当前工作树的 CLI，安装时显式带 `--allow-write`，并用 `--env ORDINE_API_URL=<本轮 Server 地址>` 与 `--env ORDINE_DESKTOP_AUTH_TOKEN_FILE=<本轮 token 文件绝对路径>` 绑定同一实例。命令入口是 `bun apps/cli/src/index.ts mcp install codex --allow-write ...`，随后用同一入口执行 `mcp doctor codex --allow-write ...`。在新 Codex 会话发现工具后，通过 ORDINE MCP 读取刚才的 Pipeline、启动运行、读取 Job/Trace。确认 UI 与 MCP 使用同一 Pipeline ID 和对应 Job ID，产物仍可访问。修好实际出现的连接、token 或会话问题；MCP 客户端的实际调用记录是这一环节的完成证据。
6. **交付能复查的结果。** 将本轮 commit、配置摘要、Pipeline/Job/Run ID、模型、事件日志、浏览器操作证据、产物路径及 SHA256 放入同一交付目录，不写凭据。只运行受影响的现有检查；保留的真实 LLM 用例按原入口执行，未具备条件的其他 provider 明确标为未运行。选定 runtime 的真实文件执行以及步骤 2–5 必须全部完成，才允许交付主链路并将 COD-390 置为 Done。精简测试与发布计划的 PR 合并只完成准备阶段。

## 本次精简与保留边界

基线：`7f63ac3d`。本次修改位于 `chore/streamline-runtime-tests`；原主目录的未提交修改保持原样。

- 删除 15 个 ownership/归属专项用例：项目切换归属、proposal/session、Job/Pipeline、Operation/graph、MCP 注册归属，以及仅验证控制器归属或扫描源码的测试。
- DSH 独立单测 **3 → 0，删除 100%**，达到至少削减 80% 的要求；runtime manifest 和扫描测试里的两处 DSH 专属断言也已移除。通用客户端目录仅保留一个 DSH 枚举成员。若按这六处显式 DSH 校验统计，**6 → 1，减少 83.3%**；此数字不是单元测试用例数量，目录枚举也不是集成执行证据。
- 保留真实 LLM 测试及原入口：
  - `packages/agent/src/mastra/runMastra.test.ts`：Kimi 真实调用。
  - `packages/agent/src/openclaw/runOpenclaw.integration.test.ts`：OpenClaw 真实调用。
  - `packages/services/src/agentRunsService/agentRunsService.windows.integration.test.ts`：Codex、Claude Code、OpenCode 的真实执行、文件写入、续跑和取消。
  - `.github/workflows/runtime-integration.yml` 及现有 MCP 集成测试保留。
- 本次不修改生产归属检查、DSH adapter 或其他 runtime 实现。后续实现工作只修改实际阻断。
- 不追逐覆盖率数字、不恢复 ownership/DSH 专项、不新开以增加单元测试数量为目标的任务。缺少凭据、服务或平台条件时写“未运行”，不能写“通过”。

真实 LLM 执行仍使用原文件和原开关。在对应 package 目录运行 `bun run test <测试文件相对路径>`：Kimi 使用 `KIMI_API_KEY`；OpenClaw 使用 `OPENCLAW_INTEGRATION=1` 与可用 gateway；Windows 用例使用 `ORDINE_WINDOWS_RUNTIME_ACCEPTANCE=1`、`ORDINE_WINDOWS_RUNTIME_ACCEPTANCE_ROOT` 和独立数据库，`ORDINE_WINDOWS_RUNTIME` 可选择 Codex、Claude Code 或 OpenCode。这些入口、成功条件和已有 skip 条件均未修改。

## 唯一完成标准

同一版本、同一条真实任务能够从对话走到落盘文件，刷新可恢复，取消有效，错误可诊断，UI 与真实 MCP 操作一致，并附上可核对的运行证据。单元测试全绿、模型出现在目录里、MCP doctor 成功，均只是其中一段证据。

## 旧计划处理

- 2026-09-05 只读检查了 Ordine 的全部非归档 `Testing` 事项，共 COD-374 和 COD-364 两项，无下一页。
- COD-374 已标为 COD-390 的 Duplicate，并在原描述顶部标记测试导向清单废止，历史描述保留。
- COD-364 保持 Done，保留真实 LLM 入口和历史交付，并已在描述顶部注明旧补测清单不再构成后续待办，后续按 COD-390 推进。
- COD-369 已完成的 runtime/MCP 实现及真实 LLM 验收记录继续保留，COD-370 的其他 runtime 功能扩展维持原范围。它们不成为本条主链路的新测试门槛。

## 本次已验证与尚未完成

2026-09-05 在该工作树重新运行相关保留测试：Agent 140、Services 51、MCP Installer 11、Pipeline Actions 9，共 **211 个通过**，四条命令最终退出码均为 0。Agent 套件另有 3 个真实外部调用用例因当前条件未配置而跳过；Windows 真实 runtime 验收本次未启动。本轮最终输出替代旧草稿的 213 计数。

受影响包及依赖的 typecheck/lint 共 29 项成功，最终退出码 0，本轮均命中共享工作树缓存。真实 LLM 文件、原 workflow、Windows MCP 集成文件及测试入口配置共 11 个文件的 Git blob 均与基线一致。删减审计确认总共删除 18 个用例声明，其中 ownership/归属 15 个、DSH 3 个；没有新增用例。

发布前全量 `bun run quality` 已通过：21/21 项成功，18 项缓存，退出码 0。使用独立 PostgreSQL（15432）与测试数据库；补齐 Windows 上既有 CLI 用例要求的 `/tmp` 目录，并通过 `bun install --frozen-lockfile --force` 恢复缺失依赖后重跑，锁文件和测试代码未因此改动。全部 9 个变更文件的格式检查通过。全仓 `bun run format:check` 仍报告 150 个未修改文件的既有格式问题，不作为本 PR 的格式修复范围。

本轮命令、退出码、日志、逐文件删减计数和保留文件 blob 对照保存在工作区父目录的 `outputs/streamline-runtime-tests-20260905/`。它是执行证据，不是另一份计划。修改的文档按仓库 oxfmt 配置格式化，CI 格式检查覆盖全部变更文件；差异检查使用 `git -c core.whitespace=cr-at-eol diff --check`。

这些结果证明本次精简后的相关测试可运行；本计划中的产品主链路尚待执行，不能据此宣称产品已跑通。COD-390 保持 In Progress，最终合并与交付状态以关联 PR 和该事项为准。
