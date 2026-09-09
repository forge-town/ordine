# Ordine 项目指令

Ordine 是 AI 优先的工作流编排引擎。使用 Bun（版本见根 `package.json`）和 Turborepo；从本仓库根目录运行下列命令。

## 按任务读取

- [CodeGuidelines.md](CodeGuidelines.md) 是代码规范的唯一权威来源；修改对应层时查阅相关章节，不要求每次通读。纯文档改动只需检查内容、引用和格式。
- UI 布局和样式变更参考 [docs/frontend-ui.md](docs/frontend-ui.md)；共享页面在 `packages/views/src/`，平台入口在 `apps/app/` 和 `apps/desktop-app/`。
- 数据与执行链主要在 `packages/schemas/`、`packages/models/`、`packages/services/`、`packages/pipeline-engine/` 和 `packages/agent/`；tRPC 路由在 `apps/app/src/integrations/trpc/routers/`，独立 API 在 `apps/server/`。
- 按需使用任务匹配的技能及其相关引用。`skills-lock.json` 是安装记录，不代表技能当前可用；历史笔记中的故障和状态需重新核实。

## 工作范围与完成标准

- 在用户授权范围内完成实现、必要验证和由改动引起的修复；常规可逆操作无需逐步确认。遇到影响结果的关键歧义或缺少高风险操作授权时再询问。
- 保留已有未提交工作。需要切换分支或隔离代码修改时使用 worktree；不要在脏工作区执行 checkout、reset 或覆盖无关文件。
- 子代理仅在用户或适用工作流要求且存在独立、明确的子任务时使用。只允许主代理委派一层；同一文件的编辑串行进行，主代理负责审阅和验收。普通任务不自动启用 Sol-Luna。
- 不泄露凭据，不将测试指向生产或用户日常数据库。数据库测试使用独立测试库；生产变更需在授权范围内备份并验证。保留认证、权限和文件路径边界。
- 结论区分已实现、已验证和未验证。涉及 Pipeline/Agent 交付时核实实际产物、内容和来源；`Job done`、健康检查或 CI 状态不能单独证明交付。

## 验证

- 根据改动范围和风险选择受影响的测试、类型检查、lint 或浏览器验证。通过后，仅在新改动、失败或尚未解决的风险需要时扩大或重复检查。
- 低风险文档、文案或格式改动无需为流程补测试。涉及认证、持久化、调度或跨步骤产物的改动，保留相应行为与集成验证。
- 已配置的独立本地测试可直接运行并修复本次改动引起的失败。涉及真实模型或外部服务时沿用任务授权与预算，并注明实际执行的路径。
- 使用仓库的 oxfmt 配置检查改动文件：`bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check <files>`。不要为局部改动全库自动格式化。
- 测试与检查命令见受影响包的 `package.json`。全量入口为 `bun run quality`；CI 必需检查以 [.github/workflows/ci.yml](.github/workflows/ci.yml) 为准，本地无需重复已经对同一内容通过的检查。
- UI 行为变更提供实际浏览器验证；视觉变更附桌面与窄视口 before/after 截图，可存入 `pr-assets/`。CLI/REST 结果不能替代 UI 或 Desktop IPC 验证。

## Git 与发布

- 新工作分支基于最新 `upstream/develop`；继续已有任务时使用其分支。
- 工作分支只推送到 fork `woodfishhhh/ordine`，不得推送到 `forge-town/ordine`；PR 目标为上游 `develop`。
- 提交格式为 `<type>: <中文描述>`，使用 Conventional Commits 类型。
- 用户授权合并时，核实当前 PR head、review 和必需 CI，通过受保护的 squash 合并路径；PR CI 与合并后的 `develop` CI 分开报告。

## 本地开发

- `bun run dev` 启动应用；Web 默认端口 9430，独立 API 默认端口 9433。
- 仅在本地开发需要时设置 `ORDINE_LOCAL_MODE=true`；PowerShell 使用 `$env:ORDINE_LOCAL_MODE = 'true'`。不得用本地登录绕过代替认证验证。
- 包通过公开入口暴露 API，使用 ESM 和 `workspace:*`。根 workspaces 已包含 `apps/*`、`packages/*`，只有超出这些路径时才需修改注册。
