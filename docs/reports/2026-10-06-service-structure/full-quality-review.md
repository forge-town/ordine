# Task2 全量 Service 质量审查

**结论：PASS_CHECKPOINT**。当前 27 个 Service 的结构、静态类型、lint、导出、消费者类型和隔离数据库测试均通过，未发现新的迁移代码阻断。此报告仅审查当前工作树 `/Users/amin/projects/ordine-service-structure` 的 Task2 Service 迁移，不代表生产、PR、合并或最终业务验收。

审查日期：2026-10-07。基线：`03721ab082172699479690714b15c342c0144382`。本轮只读源码和运行检查；唯一写入为本报告。没有修改源码、数据库、凭据、规范、MCP、提交或推送；隔离数据库复跑由父代理在明确测试数据库环境中完成。

## 审查依据与方法

已阅读项目 `AGENTS.md`、`CodeGuidelines.md`、批准的双语设计与已有结构/测试保留证据，并复用已完成的 brainstorming 范围评估。适用技能及 references 已读取并逐项对照：`service-best-practice`、`barrel-export-best-practice`、`no-re-export-best-practice`、`cognitive-dimensions-best-practice`。CodeGuidelines 与用户批准的迁移设计优先；旧技能中与既有 Promise/Result、原生错误、公开 class、跨 Service 协作、叶子命名和真实入口冲突的模板规则按项目规则覆盖。

检查覆盖：27 个 Service 入口和 methods/helpers 集合；typed `Pick` bindings、每实例 DAO/state、live getter 与 receiver；runtime import 环和 barrel/no-re-export；公开 `@repo/services` 入口及 `apps/server/src/services.ts` 消费者；原测试、fixtures、snapshot/PDF、真实模型/Windows/数据库入口；服务包类型/lint/测试守卫；认知维度中的隐藏依赖、易错性、可见性、粘滞性和困难心理操作。

## 证据结论

### 结构与薄聚合

当前结构验证列出预期且实际相同的 27 个 Service：`agentControlService`、`agentRunsService`、`agentRuntimesService`、`agentsService`、`capabilityCatalogService`、`capabilityHarvestService`、`connectorsService`、`conversationMessagesService`、`distillationsService`、`executionService`、`filesystemService`、`githubProjectsService`、`jobsService`、`operationOutputItemTemplatesService`、`operationRunnerService`、`operationsService`、`pipelineAgentSessionsService`、`pipelineAssetsService`、`pipelineRunnerService`、`pipelinesService`、`projectsService`、`refinementsService`、`routineSchedulerService`、`routinesService`、`settingsService`、`skillsService`、`usageService`。

每个 Service 都有 `<name>.service.ts`，methods/helpers 集合和每个叶子都有 `index.ts`、实现及标准 spec；可选场景 spec 只出现在已声明的边界场景。入口主要是依赖、状态、helper/method 组装和返回公开 API。较大的组装文件仍主要是 bindings/state wiring：`pipelineAgentSessions.service.ts` 281 行、`agentRuns.service.ts` 270 行、`agentControl.service.ts` 213 行、`pipelineRunner.service.ts` 194 行；未发现把业务方法重新留在聚合入口的证据。

脚本扫描 44 个 `index.ts`：全部为相对路径 `export *`，无默认导出、显式转导出、业务声明或悬空目标。非 index 文件未发现 re-export。`packages/services/src/index.ts` 保留公开领域入口与 execution/support 子入口；`apps/server/src/services.ts` 仍通过公开 `@repo/services` 工厂创建消费者实例，AgentRuns 类型注解只是当前工厂返回类型的显式化。

### DI、状态、late binding 与 receiver

入口级 state 均在工厂内单实例创建并通过 bindings getter 使用；未发现 map/set/admission/queue 的 clone 或跨实例共享。已对全部 Service 的入口和叶子进行静态读查，未见新的入口级运行时循环；AgentRuns 修复后的独立 TypeScript AST 导入图对 87 个生产模块报告 0 个内部运行时环，公开 `AgentControlModeUnsupportedError` 定义与基线文本一致，initializeRun 反向引用为 type-only 且构造器通过同一 getter 注入。

AgentRuns receiver/live getter 回归已重新通过：普通注入 `scan`/`runAgent` 的 receiver 仍为 `undefined`，第二次调用读取 replacement，原对象成员 receiver 保留。其他 Service 的跨领域协作主要在已存在的 factory/options ports 或直接 helper imports 中；本轮未观察到因迁移新增的 constructor-time getter 读取。

### Service/DAO/API 质量

生产 Service 代码未发现直接导入数据库连接执行普通查询；读写经 DAO，事务仍沿原注入连接。无新增生产 `any`；生产中的 `as unknown` 多为 JSON/跨事务边界或原领域解析，需保留原协议，不能据此宣称所有窄化均已形式化。以下是非阻断观察：

- `projectsService/methods/delete/delete.method.ts:19`、`agentControlService/methods/resourceControlArchive/resourceControlArchive.method.ts:33`、`executionPreflightRoutine.method.ts:26` 使用 `this as unknown as ...` 访问同一返回对象的兄弟方法。这是迁移后保留原对象协作语义的隐式依赖，增加隐藏依赖和易错性；最小改进是将兄弟方法作为 typed binding 注入，或让 factory 组装完整对象后再绑定方法，并补 receiver 场景。当前未判为迁移阻断，因为基线同样依赖 `this`，现有服务测试和类型检查通过。
- `agentControlService/methods/resourceControlCreate/resourceControlCreate.method.ts:34,53,93` 仍有 schema 分支后的 `as z.infer`/`as never`。这些是领域联合映射的窄化点；本轮未发现由拆分引入的新运行时错误，但应作为后续安全性债务，不能用 lint 通过替代证明。

### 测试、fixtures、真实入口

已有 `test-preservation-review.json` 和 summary 显示 27 个 Service 的原断言均未缺失；`routinesService` 的一个原测试标题发生拆分/合并（原 `reads delegate to the dao and wrap meta` 现拆到多个 method spec），对应断言仍存在，未视为行为缺失。保留的 PDF fixture、snapshots、Windows 门槛、真实模型/平台入口均在当前树可定位；未运行真实 Windows、真实模型或数据库。

已运行：

- `bun run --cwd packages/services check-types`：退出 0。
- `bun run --cwd apps/server check-types`：退出 0。
- `bunx oxlint --config packages/services/.oxlintrc.json packages/services/src/agentRunsService`：无 error，有 warnings。
- 包级 lint：无 error，有 warnings，主要是未使用测试 fixture、`no-await-expression-member`、`no-negated-condition`、数字分组等；未将 warnings 说成 clean lint。
- `bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check packages/services/src/agentRunsService`：退出 0，131 文件格式通过。
- `git diff --check`：退出 0。
- `ORDINE_EXECUTION_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:36435/ordine_pipeline_v2_r5 bun run --cwd packages/services quality`：父代理在明确隔离数据库中复跑通过；519 个测试文件通过、7 个跳过，1161 个测试通过、26 个跳过。数据库仅为隔离 execution integration 数据库；未指向日常或生产数据库。

当前证据支持：隔离数据库复跑的 519 suites/1161 tests 通过、7 suites/26 tests 跳过，类型、消费者类型、格式和 lint 无 error。当前证据仍不支持：真实 Windows、真实模型、生产读回或完整 27 Service 外部运行协议。

## 适用技能 checklist

### Service

- Service 位于 services 包：通过。
- 工厂保留公开 API/DI/state：通过静态结构与消费者 readback；不宣称行为全覆盖。
- DAO 注入、无普通 db 直查：通过源码扫描。
- 叶子方法/helper 与标准 spec：通过结构扫描。
- 正常/边界测试：已有原断言保留；完整质量的隔离数据库测试已通过；真实 Windows/模型仍未运行。
- 错误/Result/清理语义：未见迁移新增重写；真实 integration 未运行。

### Barrel

- 所有目标目录 index 存在：通过。
- 仅相对路径 `export *`：44 个 index 全通过。
- 无 default、显式转导出、业务逻辑、悬空路径：通过。
- 运行时循环：目标 Service 静态扫描未发现；不把 type-only 边视为环。

### No-re-export

- 非 index 无 `export ... from`：通过。
- 无 import 后再次转出同名符号：通过扫描。
- 消费者直接从公开来源 import：公开服务消费者通过；部分内部 helper 仍按既有本地 barrel 使用，未见新转发文件。

### Cognitive dimensions

- 隐藏依赖：兄弟方法 `this as unknown` 是明确观察项，位置和最小改进已列。
- 可见性/可并置性：typed bindings 使依赖清单显式，但大型入口将状态和叶子 wiring 分散，属于可导航成本而非阻断。
- 易错性：`as never` schema 分支与缺失 DB integration 环境是明确风险边界。
- 粘滞性：新增叶子使局部修改更集中；跨阶段 lifecycle 仍需同步 bindings 和 state，现有测试提供反馈。
- 困难心理操作：execution/AgentRuns/Planning shutdown 和 lease 时序保留，但未宣称外部 DB/Windows 已验证。
- 未以文件数、风格偏好或总分判定；每项观察都有位置、任务、权衡、最小改进和验证路径。

## 最终复核

没有发现新的 P0/P1 迁移缺陷，也没有足够证据将 inherited `this`/narrowing 观察升级为阻断。父代理已在明确隔离数据库 `postgresql://postgres:postgres@127.0.0.1:36435/ordine_pipeline_v2_r5` 下复跑 services 全套，结果为 519 suites passed/7 skipped、1161 tests passed/26 skipped；root check-types/lint 也通过。本机仍未运行真实 Windows、真实模型、生产读回或完整外部运行协议，因此这些边界保持未验证。当前检查点判为 **PASS_CHECKPOINT**；此报告不批准生产写入、PR、合并或最终全 27 Service 交付。
