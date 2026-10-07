# AgentRuns 独立规格检查点

**结论：PASS_CHECKPOINT** — AR-SPEC-01 已修复并通过独立复查；AgentRuns 当前检查点未发现未解决的规格缺失或越界项。

本报告仅审查 `packages/services/src/agentRunsService/` 相对基线 `03721ab082172699479690714b15c342c0144382` 的规格一致性。它不是代码质量审查、全 27 Service 审批、Task2 完成、生产保存、PR 或发布结论。审查日期：2026-10-06。

## 范围与依据

已阅读 Ordine `AGENTS.md`、`CodeGuidelines.md`、已批准的 `docs/specs/2026-10-06-ordine-service-structure-design.md`，并使用 brainstorming 完成范围、风险、验证方法评估。沿用已批准设计，不另开设计或实现任务。重点为 AC02 工厂及依赖注入兼容、AC03 行为和原断言保留、AC04 公开入口、AC05 真实叶子及测试归属。

CodeGuidelines 是 Ordine 唯一规范权威；批准设计覆盖旧 one-file Service 模板。原 Promise/Result、错误处理与清理行为按兼容性要求保留，不以旧 Service 技能的 `__spec__`、Promise-only 或其他模板要求扩大修改。本轮未修改源码、数据库、生产配置或执行 Git 变更操作，只创建并更新本报告。

## 已修复的问题及独立回读

### AR-SPEC-01 — 注入函数 receiver 差异（已修复）

- **位置**：`packages/services/src/agentRunsService/helpers/resolveRuntime/resolveRuntime.helper.ts:16`；同类位置 `packages/services/src/agentRunsService/helpers/executeRun/executeRun.helper.ts:264`。
- **原要求**：AC02、AC03 以及设计第 5 节要求保留依赖注入契约、运行行为和错误语义。
- **首次审查发现的变化**：基线将依赖先保存为局部变量，再执行 `scan()` / `runAgent(options)`。修复前执行 `serviceBindings.scan()` / `serviceBindings.runAgent(options)`。ESM 严格模式下，普通注入函数的 `this` 从 `undefined` 变成整个内部 bindings 对象。类型允许普通函数注入，没有排除 receiver 可观察行为。
- **触发**：注入普通 `function`，在函数内检查 `this`、根据 `this` 分支或将其交给其他函数。原来接受裸调用的函数现在可以抛错、走不同分支，且能意外观察私有状态。这不是原业务行为。
- **修复前实际复现**：通过 Bun 导入当时的 `createResolveRuntimeHelper`，注入 `scan: function () { observed = this; return Promise.resolve([]); }`，使用 local/codex 配置；无检测路径时捕获后续预期的 resolution 失败。对同一函数以 `const scan = bindings.scan; await scan()` 模拟基线调用，输出 `baselineThisUndefined: true`；调用实际迁移后的 helper 输出 `migratedThisIsBindings: true`。未调用真实 runtime、模型或数据库。
- **已落实的修复**：在调用时保持 getter 的延迟读取，同时恢复裸调用，例如 `(0, serviceBindings.scan)()` 与 `(0, serviceBindings.runAgent)(options)`，AgentRuns 共 43 个原裸调用采用此形式。原 `serviceBindings.runsDao.update(...)`、`serviceBindings.db.transaction(...)` 等对象方法保持成员调用，不解构或缓存共享状态。新增两个 receiver scenario，并已重新运行定向测试及类型检查。

- **修复后独立复现**：重新导入实际 `createResolveRuntimeHelper`，输出 `baselineThisUndefined: true`、`migratedThisUndefined: true`、`migratedThisIsBindings: false`。进一步用可计数 getter 和行为不同的两次 scan 注入验证：工厂构造时 getter reads 为 0，两次调用后 reads 为 2，调用记录为 `['first', 'replacement']`，两个函数的 receiver 均为 `undefined`。
- **对象 receiver 完整性**：对 47 个原叶子声明逐个按 AST 调用顺序比较 receiver，43 个修复位置恢复裸调用；234 个原对象成员调用的 receiver 表达式归一后与基线一致，未发现把原 `obj.fn` 调用错误解绑的情况。该数字仅指本轮 AgentRuns 源码，不是其他 Service 或通用 extractor 的审批。
- **回归用例读查**：`helpers/resolveRuntime/receiver.scenario.spec.ts` 使用普通 scan 函数断言 undefined receiver；`helpers/executeRun/receiver.scenario.spec.ts` 经公开 `start`/`wait` 生命周期，在 mock 的普通 runAgent 函数中断言 undefined receiver，并确认 completed 状态。两个文件都在对应真实 helper 叶子中，原标准 helper spec 保留。live replacement 另以上述独立 getter 计数与不同调用标记复现验证，不仅依赖测试名称。

## 质量修复后的必要规格回读（2026-10-06 23:47）

这次仅复核质量修复是否改变已批准行为，不构成质量审批。

- **公开错误类身份**：`agentRuns.service.ts:32` 的 `AgentControlModeUnsupportedError` class AST 与基线完全一致，仍由原 Service 公开入口导出。新增的 private `AgentControlModeUnsupportedError` getter（`agentRuns.service.ts:141`）直接返回该构造器，未复制、包装或创建新 class。`initializeRun.helper.ts:57` 使用 `new serviceBindings.AgentControlModeUnsupportedError(runtimeConfig.type)`；`new` 的构造目标及实例 prototype 保留。helper 对根 Service 仅保留 type import，移除了其对聚合入口的运行时反向依赖。
- **原拒绝行为**：新增 `helpers/initializeRun/initializeRun.helper.spec.ts:126` 用例经公开 `service.start`、合法请求及 opencode control mode 触发拒绝，核对公开 `instanceof`、`code = CONTROL_MODE_UNSUPPORTED`、原 name/runtime/message，并确认没有创建 run 或调用 actor。实际定向运行通过。原初始化顺序、schema parse、runtime 校验及该抛错位置在 body 对照中保留，没有为新 fixture 放宽业务校验。
- **调用语义没有回退**：对当前 47 个叶子顶层声明重做参数、body、返回注解和泛型 AST 对照，归一限定同前，并将新增 constructor getter 访问映射回已核实的同一公开构造器。差异数为 0；43 个裸调用恢复位置和 234 个原对象成员调用 receiver 再次匹配基线。
- **新增测试纠正没有修改业务结果**：`deleteExpired.method.ts` 仍返回 DAO 所删记录数组的 `.length`；新 typed fixture 传入 3 个 `{ id }` 或空数组，分别断言 3/0，并断言原 rejection identity，未改变方法实现。telemetry spec 通过内存 patch 的结果确认 failure count 从 2 到 3、原读取对象仍为 2；scan scenario 现在明确断言 `['original', 'replacement']`，可以识别错误缓存旧依赖。
- **原测试未动**：再次收集当前 50 个测试声明，对基线 15 个原声明逐一比对，均唯一存在且完整 AST 不变。新增或修正的测试只发生在迁移后新增覆盖中，原 shutdown、Windows、controller、事件与恢复用例未被替换。

## 已核实且未发现差异的部分

1. **结构与责任**：14 个 method、27 个 helper，共 41 个真实叶子；逐目录确认必需的 `index.ts`、对应 `.method.ts` / `.helper.ts`、同名标准 `.spec.ts` 均存在，methods/helpers 集合各有入口。无聚合入口旁 `.service.spec.ts`。拆分覆盖原公开方法及真实辅助责任，没有将整个工厂伪装成单叶子。`executeRun` 负责一次运行和重试生命周期，`initializeRun` 负责记录、transient 与 lease 初始化；它们没有包含整个工厂的所有职责。
2. **工厂与单实例状态**：基线与当前工厂参数 AST 一致。19 个原始状态/依赖声明（含 `AdmissionClosedError`）的初始化 AST 和相对顺序一致：DAO、注入函数、超时、executor ID、activeRuns、admission、startingRuns、executions、listeners、eventPersistenceQueues。bindings 的 getter 只在读取时访问同一闭包变量；wrapper 创建时不读取这些 getter，没有 clone map/set/admission，也没有新实例级共享状态。该服务根作用域没有需要 setter 的原 `let` 重新赋值。被提取原函数均不依赖提前执行的 hoisted declaration。
3. **函数体对照**：独立 TypeScript AST 对照检查了 47 个顶层叶子声明（含一个叶子中的多个原 sanitation 函数）。修复后再次对 `serviceBindings.x` → `x`、已验证 receiver 的 `(0, serviceBindings.x)` 裸调用及对象 shorthand 等价表示归一，忽略格式/尾逗号后，函数体、参数、显式返回注解、泛型均一致。静态归一不单独证明运行行为，故另外执行了逐调用 receiver 核对、独立复现和回归测试。没有发现属性名、字符串或嵌套 shadow 被误替换。
4. **关键语义读查**：事件 persistence queue 仍对同一 run 串行 `previous.then(operation, operation)`；事务完成后才 broadcast；terminal 去重、activity projection 回建与指标更新位置保留。取消、关闭 admission、等待初始化/执行收敛、transient disposer、lease heartbeat、恢复 interrupted 两事件顺序、resume guard/单次重试、订阅与重放路径未发现额外改动。
5. **公开辅助与入口**：`createAgentRunController` 与原文件仅 type import 路径不同，`configureAgentRunController`、`sanitizeAgentRunData` 原实现文本保留。Service 入口保留工厂、公开 transient types、`AgentControlModeUnsupportedError`；原公开 helper/class/type 经 `agentRunsService/index.ts` 保留。`contracts.ts` 和 methods/helpers 集合没有从该根入口 wildcard 导出，内部 bindings 类型未增加为根包公开导出。
6. **原测试完整性**：独立 AST 收集基线 5 个测试文件的 15 个 `it` / 参数化 `it.each` 声明，逐条在迁移后的 spec 中定位，均恰好出现一次，完整调用 AST 一致，包含断言、测试回调和参数化数据。原 7 个 shutdown 测试声明因 `it.each` 对 transient/claim 展开为 8 个场景，全部保留。首次检查中的额外 31 个测试声明用于真实叶子标准 spec；后续新增 receiver、公开错误类及纠正 deleteExpired spec 后，当前共 50 个测试声明，其中 15 个原声明均保留。
7. **fixtures 与平台边界**：shutdown fixture 的 executable 路径由 `C:/fake/codex.exe` 改为 `resolve('/fake/codex.exe')`，使原本被 macOS `node:path.isAbsolute` 拒绝的假路径成为本机绝对路径；原测试回调、超时和成功断言未放宽。Windows 场景文件与基线逐文本 diff 仅有工厂 import 路径变化；`process.platform === 'win32' && ORDINE_WINDOWS_RUNTIME_ACCEPTANCE === '1'`、runtime 选择门槛和执行入口保留。AgentRuns 基线无 PDF/快照资产需要迁移。

## 修复后本轮实际验证

| 验证                                                        | 结果                                                             | 证据边界                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `bun run --cwd packages/services test src/agentRunsService` | 退出 0；43 files passed / 1 skipped；50 tests passed / 4 skipped | 2026-10-06 23:47:47 本机运行，4.57s；4 条 skip 为原 Windows 场景，未运行真实 Windows/Codex  |
| `bun run --cwd packages/services check-types`               | 退出 0                                                           | 修复后本轮独立运行；不等同所有消费者类型检查                                                |
| 实际 `createResolveRuntimeHelper` receiver 与 getter 复现   | 通过                                                             | 新旧 receiver 均 undefined；构造时零读取、每次调用重新读取并使用替换后的函数                |
| 47 声明 AST 及逐调用 receiver 对照                          | 0 差异                                                           | 43 裸调用修复，234 原对象成员调用 receiver 保留；参数、body、返回注解与泛型按说明归一后一致 |
| 原函数/测试 AST、原 controller 文件 diff、结构清单          | 前述首次检查结果仍适用                                           | 当前原 15 测试声明再次确认不变；新增公开错误类验证；未扩大为其他 Service 审批               |

首次检查为 41 files / 45 tests 通过，因独立复现发现 receiver 差异判 FAIL；修复后增加两个有针对性的 receiver 回归，第二次独立运行是 43 files / 47 tests 通过。质量修复后的必要规格回读再次独立运行，当前为 43 files / 50 tests 通过。原 Windows 4 条跳过保持不变。

未在本轮重跑全包测试、lint、真实模型、Windows 验收或数据库集成；父代理及实现代理所述其他检查不代替本轮证据。本轮未执行生产保存、提交、推送或 PR 操作，也未审查 AgentControl 或通用 extractor 的完整可支持语法范围。

## 交付前结果复核

已复核结论与实际工具结果：AR-SPEC-01 的两类注入函数 receiver 已恢复，live getter 行为通过独立复现，原对象方法 receiver 未被破坏；公开错误类 identity、原拒绝字段与时机保留；质量修复后的定向测试及类型检查通过。当前无已确认未解决的 AgentRuns 规格缺失或越界项，判为 **PASS_CHECKPOINT**。

该结论仅准许 AgentRuns 进入后续独立质量审查，不代表质量审查通过、全 Task2 完成或全 27 Service 通过。其他 Service 的实现及最终全 27 独立规格、质量、整体验证仍待父代理完成。
