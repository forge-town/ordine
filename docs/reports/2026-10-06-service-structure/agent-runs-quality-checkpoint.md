# AgentRuns 独立代码质量检查点

**结论：PASS_QUALITY_CHECKPOINT**。两个 P2 项已修复并通过本轮独立回读。结论仅覆盖 `packages/services/src/agentRunsService/**` 相对 `03721ab082172699479690714b15c342c0144382` 的本次迁移；不审批其他 Service、完整 Task2、全部 27 Service、extractor、生产写入或 PR。

审查时间：2026-10-06。本轮只读源码，唯一写入为本报告；未提交、推送、保存 MCP、创建代理或访问日常数据库。

## 评估、规范与范围

已完整阅读 brainstorming 及其 workflow/formal-design-lean/checklist，并读取已批准双语设计、当前 CodeGuidelines、AGENTS、独立规格检查点。此次为获批设计内的独立只读质量审查，不新建设计或实现计划，也不重复请求批准。比较方案为仅检查文件布局、只依赖测试绿灯、以及源码调用路径结合有界实际验证；采用第三种，重点是 DI/getter、receiver、共享状态、时序与新增测试的有效性。成功标准是本检查点无新增兼容性风险、无违背适用规则的依赖、测试真实反映契约。

已完整阅读 service-best-practice、barrel-export-best-practice、no-re-export-best-practice、cognitive-dimensions-best-practice 及所有必需 references；认知技能示例亦已读。Ordine 无 CodeGraph，按源文件定位。CodeGuidelines 为唯一规范 authority，批准结构及保留行为要求覆盖旧技能的 camelCase 单文件、object-only、Promise-only、`__spec__`、强制 Zod 化所有内部类型、禁止已有跨 Service 协作等要求；既有 Promise/原生错误/清理语义不因技能模板重写。父任务追踪由父代理维护，此只读检查点不重复注册运行任务。

## 首次发现及已完成修复

以下描述保留首次审查的触发与证据，旧代码行号仅用于问题溯源；当前修复状态与证据见各项末尾。

### AR-QUALITY-01 — [P2] 初始化叶子运行时反向导入组装入口

- **实际位置**：`packages/services/src/agentRunsService/helpers/initializeRun/initializeRun.helper.ts:19-24`，尤其运行时值 `AgentControlModeUnsupportedError`；使用位置为该文件第 57 行。
- **触发与证据**：入口 `agentRuns.service.ts` 从 `./helpers` 导入工厂；`helpers/index.ts:27` 导出 initializeRun 叶子；叶子又通过上述运行时 import 返回入口。链为 `agentRuns.service → helpers/index → initializeRun/index → initializeRun.helper → agentRuns.service`。这不是可擦除的 type-only 引用。
- **影响**：违反 barrel checklist 第 5 项无环要求。直接载入本应局部可测试的初始化 helper 会拉入整个组装入口及其方法集合，增加 ESM 初始化顺序和 mock 隔离耦合。当前读取错误类发生在调用时，现有测试通过；未发现或声称当前存在 TDZ 崩溃。
- **最小修复**：保留公开错误类定义及身份；像现有 AdmissionClosedError 一样，将相同构造器通过 typed bindings getter 注入 initializeRun。私有契约可以 type-only 引用其类型，helper 对入口仅保留类型引用。不要复制错误类、转发非 index 导出或改变公开 API。
- **验证**：确认上述运行时环消失，运行 AgentRuns 定向测试、类型和格式检查；unsupported control runtime 仍抛同一公开类实例，code/name/runtime/message 保留。

- **修复回读（已解决）**：initializeRun 第 19-23 行现为 `import type`，第 34 行 Pick 包含错误构造器，第 57 行通过 bindings 实例化。根第 141-143 行 getter 返回同一公开类，contracts 第 107 行使用 `typeof AgentControlModeUnsupportedError`。独立 TS AST 导入图检查 87 个生产模块，排除可擦除类型引用后运行时环为 0；公开错误类定义与基线逐文本完全相同。`initializeRun.helper.spec.ts:126-138` 经公开 start 验证 instanceof/code/name/runtime/message，以及未创建记录、未启动 actor；本轮通过。

### AR-QUALITY-02 — [P2] 新 deleteExpired 测试固化错误返回契约

- **实际位置**：`packages/services/src/agentRunsService/methods/deleteExpired/deleteExpired.method.spec.ts:7-9`。
- **触发与证据**：mock DAO 返回数字 `3`，整个依赖被 `as never` 绕过，随后断言服务返回 `undefined`。原基线和当前 `deleteExpired.method.ts:7-10` 均声明 `Promise<number>` 并返回 `deleted.length`；真实 DAO `packages/models/src/daos/agentRunsDao/agentRunsDao.ts:124-129` 返回 `.returning({ id })` 的数组。
- **实际复现**：Bun 导入实际 method factory，DAO mock 返回三条 `{id}` 时结果是 `3`；返回数字 `3` 时结果才是 `undefined`。未访问真实数据库。
- **影响**：本测试没有验证任何合法成功路径，并把非法 fixture 造成的 undefined 当成兼容 API。即使破坏成不执行删除的空方法也能通过，当前全绿不能证明该叶子契约。
- **最小修复**：DAO mock 使用真实数组形状，断言三条记录返回 3；按需用同一参数化用例覆盖空数组返回 0。去掉此 fixture 不必要的 `as never` 或为 DAO 方法 mock 使用其真实返回类型，避免再次接受数字。无需改业务实现或放宽类型。
- **验证**：定向 spec 应通过；错误返回 undefined 应使其失败。可保留拒绝传播边界，不以内部委托次数作为主要验收。

- **修复回读（已解决）**：deleteExpired spec 第 5-19 行给出真实 RunsDao 类型的 mock 组装；第 22-29 行使用三条 `{id}` 数组/空数组并断言 3/0；第 31-35 行断言拒绝保持同一 cause。无 `as never`。业务实现仍返回 deleted.length；类型检查与三条场景本轮通过。

## 非阻断观察与认知权衡

每项按具体任务 → 位置 → 主维度 → 成本 → 权衡 → 最小改进 → 验证记录。

1. **隔离调试不支持的 control runtime** → initializeRun 第 19-24、57 行及 helpers barrel → **隐藏依赖** → helper 的运行时 import 反向加载入口，读者需跨越组装/集合追踪加载顺序 → 保留公开类身份有价值，但不需要运行时环 → AR-QUALITY-01 的同一构造器 DI → 上述断环及 instanceof 验证。首次为阻断；当前修复已按同一路径复核通过。
2. **验证清理过期记录返回数量** → deleteExpired spec 第 7-9 行 → **易错性** → `as never` 使不可能的 DAO 结果逃过编译，错误断言反而变绿 → 测试可以使用局部 mock，无需真实 DB → AR-QUALITY-02 的数组 fixture/数量断言 → 实际形状与无效形状已运行对比。首次为阻断；当前修复已按同一路径复核通过。
3. **验证 telemetry 计数递增** → `methods/recordActivityTelemetry/recordActivityTelemetry.method.spec.ts:6-14` → **渐进式评估** → DAO update 无论收到何种 patch 都返回固定 updated，测试无法区分增量实际被保存与仅返回 mock 数据 → 小型 DI 测试成本低，当前断言仍覆盖方法返回值透传 → 建议把 mock 改为内存应用 patch，从原计数 2 验证返回 3；本次不要求铺设新覆盖率套件 → 改错/去掉增量应失败。作为观察项，不以其单独阻断检查点。当前已改为按实际 patch 合并的内存 mock，验证 2→3 且原对象仍为 2，独立运行通过；不再只返回预制结果。
4. **修改 scan/runAgent 调用并保留 this** → `helpers/resolveRuntime/resolveRuntime.helper.ts:16`、`helpers/executeRun/executeRun.helper.ts:264` → **易错性** → `(0, serviceBindings.fn)` 初读需理解 comma operator，直接改成成员调用会改变 receiver → 保留调用时 getter 和原裸调用语义比表面简化重要 → 保留现有表示与 receiver 测试；可在未来为关键位置加简短原因说明，无需新增通用 wrapper → 当前 receiver scenario 和正常公开 start/wait 测试通过。scan scenario 已为两版函数添加 original/replacement 标记，独立运行同时验证两次 receiver 均 undefined、第二次确实使用替换后的函数；生产 `(0, fn)` 未回退。
5. **新增一个闭包依赖** → `contracts.ts:86-154`、根 getter、leaf Pick → **粘滞性** → 需要同步私有类型/单份 getter/使用叶子三处 → 换取显式依赖清单、同一 map/set/controller 引用以及编译约束；无状态 clone，无宽泛 any/unknown 强转装配 → 保持 Pick 范围最小，勿在 factory 阶段解构缓存 getter → 类型检查和生命周期测试通过。未发现不相关领域文件需要同步。
6. **排查 admission 关闭与执行收敛** → start、initializeRun、executeRun、stopOwnedRuns → **困难心理操作** → 顺序跨四个职责，仍须理解 startingRuns 与 executions 两阶段等待 → 原共享状态/先关 admission 后等待/资源释放顺序保留，拆分提高局部聚焦但降低并置性 → 当前同名目录与原 shutdown 场景提供导航，无必要再封装或拆分 executeRun → shutdown 的延迟 create/transient/claim/resume 与 disposer failure 场景本轮通过。

未解决的维度冲突：显式 typed bindings 的冗长性与共享状态可见性；叶子聚焦与跨阶段可并置性；裸调用 receiver 的正确性与记法直观性。它们不是凭文件数量或偏好判定的不合格。过早承诺、暂定性未发现独立新增问题；不赋总分。角色、名称一致性、领域动作映射及抽象梯度沿原责任保留，方法工厂只是闭包装配，没有新增业务协议。

## 源码检查结果与适用技能逐项清单

### Service

| 项                           | 结果                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| 1 services 归属              | 通过，目标位于 services 包                                                   |
| 2 camelCase 单文件           | 被批准 `<name>.service.ts` 结构覆盖                                          |
| 3 object-only 导出           | 被原工厂/公开错误 class/type 保留要求覆盖                                    |
| 4 不直接导入 db              | 通过，DbConnection 注入；事务用原注入连接                                    |
| 5 数据通过 DAO               | 通过，含原事务内构造 DAO                                                     |
| 6 camelCase 方法             | 通过                                                                         |
| 7 Promise-only               | 被原同步/异步 API 保留要求覆盖                                               |
| 8 参数全部来自 schema        | 领域请求沿原 schema；内部绑定与 factory 契约按实际定义，模板覆盖             |
| 9 返回类型全部 schema        | 原 DAO派生/领域/内部类型保留，模板覆盖                                       |
| 10 无 any                    | 本轮生产目标扫描未发现 any 或 as never/as unknown 装配；测试见 AR-QUALITY-02 |
| 11 业务规则在 Service        | 通过，原 terminal/admission/resume guard 保留                                |
| 12 缺失记录语义              | 原 getById null、getRunRecord 抛错保留                                       |
| 13 错误处理                  | 原 ResultAsync、拒绝、事件 listener 隔离、清理顺序保留，不为模板重写         |
| 14 **spec**                  | 被批准标准叶子 spec 与 scenario 结构覆盖                                     |
| 15 DAO mock 隔离             | 通过，本次定向测试使用 mock，未连接 DB                                       |
| 16 正常/边界测试有效性       | 通过，AR-QUALITY-02 已修复；关键 shutdown/terminal/receiver 用例有效         |
| 17 无直接 Drizzle 查询       | 通过，查询在 DAO                                                             |
| 18 禁止所有跨 Service import | 旧模板与既有协作冲突时覆盖；本轮新增局部运行时环仍须修复                     |
| 19 无 DB 行类型返回          | 原 AgentRunRecord/Patch 内部契约与 schema public run 保留，不新增类型泄露    |

共享状态逐源读查：根 map/set/admission/ID/DAO 均每实例单份；factory 只捕获 serviceBindings，getter 不在叶子构造阶段执行。事件 queue 使用 previous.then(operation, operation) 并按 marker 身份清理；persistEvent 先事务提交再广播；原对象 DAO/transaction receiver 保留。lease refresh、abort/dispose、settled/cleanup/tracked 链仍在相同生命周期位置。未发现额外状态克隆、不必要业务 wrapper 或生产装配 unsafe narrowing。既有 executeRun 状态断言与 runPatch usage 断言保留，不宣称已验证所有运行时分支。

### Barrel

| 项             | 结果                                                  |
| -------------- | ----------------------------------------------------- |
| 1 有 index     | 44 个 index，含根/集合/41 叶子                        |
| 2 仅 re-export | 逐行扫描通过                                          |
| 3 无 default   | 通过                                                  |
| 4 相对路径     | 通过                                                  |
| 5 无循环       | 通过，AR-QUALITY-01 已修复；87 个生产模块运行时环为 0 |
| 6 路径真实存在 | 44 个 index 全部路径解析通过                          |
| 7 无命名冲突   | 当前 tsc 通过，未见冲突                               |
| 8 无重复导出   | 源码检查未见重复条目                                  |

Bad cases：业务逻辑/default/显式命名导出/别名/悬空路径均未发现；首次运行时循环已消除，本轮静态导入图复核无环。

### No-re-export

1. 非 index 无直接 export-from：通过。
2. 无 import 后相同标识符再次 export：通过。
3. 无纯转发中间非 index 文件：通过。
4. 跨包共享值从公开来源获取，contracts 为原创私有契约：通过；合法本地 barrel 按 CodeGuidelines 保留。
5. 无 export default 转发：通过。

### Cognitive dimensions

已明确维护者实际任务；走查 start/wait 正常路径及 shutdown/disposer failure 路径；每项有位置、单一主维度、成本、权衡、最小改进和验证。已检查局部同步点、定位并置、状态/顺序依赖、边界命名、误用、阶段推理、抽象层次、领域映射与局部反馈；未发现证据的维度不强行判分。没有用美学偏好、文件数或总分代替发现，也未提出无验证的大重构。

## 首次实际验证（保留历史证据）

| 命令/动作                                                                                                     | 结果                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run --cwd packages/services test src/agentRunsService`                                                   | 退出 0；43 files passed/1 skipped，47 tests passed/4 skipped；23:36:51，4.53 秒                                                       |
| `bun run --cwd packages/services check-types`                                                                 | 退出 0                                                                                                                                |
| `bunx oxlint --config packages/services/.oxlintrc.json packages/services/src/agentRunsService`                | 无 error，有 warnings；包括新 receiver fixture 未使用 deferred 第 30 行，其余多为迁移原表达式/常量风格。未将 warnings 说成 clean lint |
| `bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check packages/services/src/agentRunsService` | 退出 0，131 文件格式通过                                                                                                              |
| 44 个 index 内容与目标路径检查                                                                                | 无非法导出行或未解析目标；循环另外人工读源确认                                                                                        |
| 实际 deleteExpired factory 的两种 mock                                                                        | 数组三条 → 3；数字 3 → undefined                                                                                                      |

原 Windows 4 场景在 macOS 按既有门槛跳过，未运行 Windows/真实 runtime/模型/数据库集成。未执行全包测试、所有消费者类型检查或全 27 Service 质量审查。tsc 与测试绿灯没有覆盖错误 fixture 或消除静态运行时环。

## 修复后独立复查实际验证

本轮延续已批准设计内 brainstorming 评估，不扩大工作范围；源码与用例已稳定后执行。除两 P2 外，还独立读查 telemetry patch/scan replacement/getEvents fixture 三项改善：getEvents 现经 AgentRunEventSchema.parse 创建合法 codex/running/ISO timestamp 事件，原 envelope 元数据与 limit 2000 断言保留。新增 fixture 修正不改变业务实现或原模型/Windows门槛。

| 检查                                                                                                          | 本轮结果                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `bun run --cwd packages/services test src/agentRunsService`                                                   | 退出 0；43 files passed / 1 skipped；50 tests passed / 4 skipped；23:51:30，4.67 秒      |
| `bun run --cwd packages/services check-types`                                                                 | 退出 0                                                                                   |
| 定向 oxlint（同上命令）                                                                                       | 无 error；仍有 warnings，含 receiver.scenario.spec.ts 未使用 deferred；不宣称 clean lint |
| 定向 oxfmt check（同上命令）                                                                                  | 退出 0，131 文件通过                                                                     |
| TypeScript AST 静态运行时导入图                                                                               | 87 个生产模块，无内部运行时环；type-only 引用不计为运行时边                              |
| 原公开错误 class 文本对照                                                                                     | 与 baseline 完全相同；没有复制/迁移/中转定义                                             |
| public start 错误类场景、deleteExpired 3/0/拒绝、telemetry 2→3、scan original/replacement、getEvents 合法事件 | 读源核对，并随上述 50 tests 通过                                                         |

检查点现无未解决的阻断发现。私有 bindings/typed Pick/live getter 保留，错误类新增 binding 不暴露到包级 barrel；getter 返回原类，未在 factory 阶段读取；原对象 receiver 与运行时调度代码未因修复变化。保留首轮已有认知权衡与非阻断 lint 提醒。未运行真实 Windows/模型/数据库、全包/全 27 服务验收。

## 结果复核

已核对结论与工具输出、源码位置及基线；未将原有行为问题升级成本次新缺陷。没有修改源码或规范，也没有声称全 Task2、生产或 PR 完成。AR-QUALITY-01/02 已解决，独立读源和实际验证支持 **PASS_QUALITY_CHECKPOINT**。父代理可据此让唯一实现代理继续其余服务；此结论不替代最终全 Task2 规格、质量和整体验证。
