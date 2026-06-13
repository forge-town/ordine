# N22 · Connector 真实化施工手册（修 CONN-01）

> 来源缺陷：`pr-assets/eval-engineering-壓測记录.md` CONN-01 —— Connector 是与执行完全脱节的 CRUD 空壳，
> "Connect" 只翻状态，建连接器没有"连到哪"的字段，全仓无 MCP client，执行引擎从不读 connectors。
> 目标：让 Connector 真正连上 MCP server、把工具暴露给运行算子，"Connected"=真握手过。
> 纪律遵 `CLAUDE.md`：证据级现状、四要素、行数预算（默认 ~200 行/文件红线）、沙盒 `tsc --noEmit`+单测，vitest/oxlint/真机期末由用户在宿主机集中跑。提交：`feat:/fix: <中文> (N22-0x)`。

## 一、关键现状审查（证据级）

| 关注点 | 证据 | 结论 |
|---|---|---|
| 数据模型 | `packages/db-schema/src/tables/connectors_table.ts`：含 `config jsonb`、`lastSyncAt`（本为真连接预留）；`packages/schemas/src/connector/ConnectorSchema.ts`：`ConnectorConfig = z.record(z.string(), z.unknown())` | config 已是自由 record，可装 transport/command/args/env/url/tools，**零 DB 迁移** |
| method/status 枚举 | `ConnectorMethodSchema`=`mcp/built-in/direct-api`；`ConnectorStatusSchema`=`connected/needs_setup/error` | 枚举够用；error 态现成 |
| service | `packages/services/src/connectorsService/createConnectorsService.ts`：纯 CRUD（getAll/getById/create/update/delete），**无 connect/test/sync** | 需新增真连接动作 |
| tRPC | `apps/app/src/integrations/trpc/routers/connectors.ts`：CRUD，无 `connect`。UI「Connect」=`update{status:"connected"}`（假态根因） | 需 `connect` mutation；UI 改调它 |
| 工具注入路径 | `OperationNode.ts:14,146,154` 的 `GH_REMOTE_TOOLS` + `extraTools` 是先例；agent 经 `allowedTools` 把工具名传给 CLI | connector 工具按同法注入 `allowedTools` |
| 运行时是 CLI agent | `runClaude.ts:107-120` 组 `claudeArgs`：有 `--allowedTools`、`extraEnv`、`ssh`，**无 `--mcp-config`** | claude CLI 自带 MCP；只需补 `--mcp-config` 指向生成的配置 + 把 `mcp__server__tool` 加进 allowedTools；密钥走 `extraEnv` |
| MCP SDK | 全仓 grep 无 `@modelcontextprotocol/sdk`/任何 MCP client | 不引依赖（sandbox npm 被封）；自写**极简 stdio JSON-RPC 客户端**（initialize+tools/list，~120 行）|

**设计取向（重要）**：运行算子的执行体是 claude/codex 这类**自带 MCP 能力的 CLI**。因此"连接 MCP"= ①Ordine 侧做一次真握手以便 UI 列出工具与确认可用（自写极简 client）；②运行时把 connector 落成 CLI 的 MCP 配置 + 工具 allowlist 下发给 CLI。**不在 Ordine 进程内长驻 MCP 连接**——只在"测试连接"和"运行注入"两个时点用。

## 二、任务拆解（一任务一 commit）

### N22-01 · ConnectorConfig 结构化（stdio / http 两型 + 校验）
- **做法**：在 `packages/schemas/src/connector/` 加 `ConnectorConfigSchema` 判别联合：
  - `{ transport:"stdio", command:string, args?:string[], env?:Record<string,string>, tools?:McpToolSummary[] }`
  - `{ transport:"http", url:string, headers?:Record<string,string>, tools?:McpToolSummary[] }`
  - `McpToolSummary = { name:string, description?:string }`（握手后回填）。
  - 保留对旧空 `{}` 的宽松兼容（`.catch({})` 或 union 加 legacy 分支），避免现有行炸。`CreateConnectorSchema` 按 method=mcp 要求 config 合法。
- **验收**：schema 单测（stdio/http 解析、缺字段拒绝、空 {} 兼容）；`tsc`（@repo/schemas）。
- **行数**：schema ~60、测试 ~50。

### N22-02 · 极简 MCP stdio 客户端（依赖无关）
- **做法**：`packages/agent/src/mcp/mcpStdioClient.ts`：spawn(command,args,env)，按 MCP/JSON-RPC over stdio 发 `initialize` → `notifications/initialized` → `tools/list`，收集 `tools[]`，超时/非零退出/解析失败返回 `Result.err`。只读握手、用完即 kill。
- **验收**：用一个 fixture「假 MCP server」node 脚本（回 initialize+tools/list）做单测：能拿到工具列表；server 崩/超时返回 err。`tsc`（@repo/agent）。沙盒可真跑（纯 node 子进程）。
- **行数**：client ~120、fixture ~40、测试 ~50。
- **警告区**：必须真发 JSON-RPC 拿到 tools 才算成功；**绝不**因为"进程起来了"就报 connected（假态复发）。

### N22-03 · connectorsService.connect + tRPC，落库真工具与状态
- **做法**：service 加 `connect(id)`：读 connector→按 config 调 N22-02 client→成功则 `update{ status:"connected", config:{...config, tools}, lastSyncAt:now }`；失败 `update{ status:"error", config:{...config, lastError} }` 并返回 err。tRPC 加 `connect` mutation。**移除/禁止**直接把 status 手设成 connected 的路径（create/update 时 status 非法置 connected 要被拒或回落 needs_setup）。
- **验收**：service 单测（mock client 成功/失败 → 落库字段正确、状态正确、绝不在失败时 connected）；`tsc`（@repo/services + @repo/app）。
- **行数**：service ~40、router ~8、测试 ~50。

### N22-04 · UI：Add/Manage 真连接字段 + Connect 调真握手
- **做法**：`ConnectorsPage` 的 Add/Manage：按 transport 显示 command/args/env（stdio）或 url/headers（http）字段；**删掉手选 Status 下拉**（status 由 connect 结果驱动）。「Connect」调 `connectors.connect`，loading→成功展示发现的工具（tool chips）/失败展示 lastError。新组件硬性：useTranslation(en+zh)、story、data-testid。
- **验收**：浏览器目检 + 截图存 `pr-assets/`；i18n 双语键齐；`tsc`（@repo/app）。
- **行数**：每文件 <200；超出则拆子组件。

### N22-05 · 执行期把 connected connector 注入 claude-code 运行
- **做法**：运行装配处（`OperationNode`/`promptExecutor`/`agentRunner` 链，沿 `extraTools` 先例）：取 status=connected 的 mcp connector→生成 CLI 的 MCP 配置（stdio：command/args/env；http：url/headers），`runClaude` 补 `--mcp-config <临时文件>`，并把各 connector 工具映射成 `mcp__<server>__<tool>` 追加进 `allowedTools`；密钥经 `extraEnv` 传入、**不写进 prompt/trace**。运行时 runtime≠claude-code（hermes/mastra/codex）先跳过并 trace 注记（codex 注入留 N22 后续）。
- **验收**：`tsc`（受影响包）。单测：给定 1 个 connected connector，装配出的 args 含 `--mcp-config` 且 allowedTools 含 `mcp__*`；无 connector 时 args 不变。
- **行数**：+~60。
- **警告区**：密钥只走 `extraEnv`/配置文件，**禁止**进 systemPrompt/userPrompt/trace；临时 MCP 配置文件用后清理。

### N22-06 · 真机端到端 + 安全收尾
- **做法（期末真机，宿主机）**：连一个真实 MCP server（如官方 filesystem MCP，stdio）→Connect 应列出其 tools、status=connected、lastSyncAt 落值；新建一个 operation 让其用该 server 的工具，Run→JobDetail trace 见 `mcp__filesystem__*` 真调用；断网/坏配置→status=error+清晰报错（非"Connected"）。证据存 `pr-assets/`。
- **遗留登记**：凭据当前与 `defaultApiKey` 同为明文存储（config jsonb）；本期匹配现状不加密，单列安全 TODO「凭据加密/keychain」。codex 运行时的 MCP 注入单列 N22 后续。

## 三、最终验收清单（N22 合并前）
- [ ] N22-01..05 各单 commit，沙盒 `tsc` 受影响包全绿；新增单测（config schema、mcp client+fixture、connect service、注入装配）
- [ ] 「Connected」只能由真握手产生，UI 无手选状态；失败显式 error+原因
- [ ] 真机：filesystem MCP 全链路（Connect 列工具→Run 见 mcp__ 调用→坏配置报 error）证据存 pr-assets
- [ ] 密钥不入 prompt/trace；临时 MCP 配置清理
- [ ] vitest/oxlint/oxfmt 宿主机集中跑，问题以 fix 补齐
- [ ] 遗留：凭据加密、codex 注入 单列
