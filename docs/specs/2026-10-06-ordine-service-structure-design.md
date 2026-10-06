# ordine Service 结构迁移设计

## 1. 目标与范围

将 `forge-town/ordine` 的 `develop` 分支上的 27 个 Service 迁移到已确认的 Service 单元结构，保留运行行为、工厂函数与依赖注入契约、公开 API 和现有测试断言。迁移后聚合 Service 入口旁不存在 `*.service.spec.ts`，测试与具体业务方法或辅助实现共置。

当前基线为 `03721ab0`；独立工作树为 `/Users/amin/projects/ordine-service-structure`，分支为 `codex/ordine-service-structure`。初始检查发现 88 个 `*.test.ts` 文件；这是迁移覆盖清单，不是测试数量或覆盖率目标。对应生产 Finding 为 `736ed93b-3d24-45a9-b60f-ab8b24e989ab`，其 166 个结构差异包含 27 个缺失文件项和 139 个未声明结构项。

本次同时修正结构检查的合法边界：包级工具配置、发布文档、历史归档及公共执行模块需要明确声明，不能为清除告警删除必要文件。生产结构规范的具体变更先由本地复查证明其边界，再通过 MCP 更新并回读。

## 2. 非目标与替代方案

不改变业务功能、认证和权限、数据库表结构、错误语义、Pipeline/Agent 的运行协议或发布策略。保留真实 LLM 测试及其入口；未运行的外部依赖测试必须单独列出。

已选择统一 Service 单元结构并保留必要支持结构。替代方案是保留现有工厂布局、建立 ordine 专属 Anatomy；该方案降低迁移成本，但不能固化本次已确认的 Service 测试职责，所以未采用。

## 3. 架构与组件边界

Service 工厂继续接受原有依赖并返回同样的服务能力；Service 实现文件承担组装职责，业务方法与辅助逻辑提取到各自单元。保持现有 Service 目录标识以及 `createXxxService` 等公开符号，避免无关重命名。

Service 实现命名为 `<name>.service.ts`。集合目录使用现有生产 Anatomy 声明的 `methods` 和 `helpers`，各自包含集合入口 `index.ts`；叶子分别包含入口、`<method>.method.ts` 与 `<method>.method.spec.ts`，或入口、`<helper>.helper.ts` 与 `<helper>.helper.spec.ts`。按业务职责迁移测试，保留原有断言、fixtures、mock 和边界场景，不将整个聚合测试机械改名后留在入口旁。

公共包入口 `packages/services/src/index.ts` 与 `package.json` 声明的 `./execution`、`./execution-migration` 子路径保持兼容。组合入口 `serviceFactory.ts`、公共错误定义和文本导入声明保留其现有职责。更新所有受迁移影响的相对导入、桶导出、构建脚本和公开入口引用。

## 4. 支持结构与规范边界

保护 `vitest.config.ts`、`.oxlintrc.json`、`CHANGELOG.md`、`archived`，以及 `canvasExecution`、`execution`、`executionActors`、`executionArtifacts`、`executionGateway`、`executionMigration`、`executionPrompt`、`jobLease` 等支持模块。

Service Package Anatomy 为已识别的合法支持结构增加明确节点或独立组合规则。该声明不把未知文件全局放行；保留 `missingRequired`、`unexpectedEntry`、`nameMismatch`、`nestingMismatch` 的严格策略，以及 Service 叶子实现和测试的必需约束。支持模块的内部结构按其职责复查，不套用业务 Service 工厂的文件模板。

同步更新 `CodeGuidelines.md` 的 Service 结构部分，使本地权威规范与确认后的结构契约一致。项目 Git 推送目标按用户的直接指令为原仓库 `forge-town/ordine`，PR 目标为同仓库 `develop`。

## 5. 数据流与错误处理

调用方继续通过公开入口获得工厂，再传入现有依赖并调用相同服务方法。提取后的方法接收所需依赖并返回原有结果；组装层只绑定依赖与方法，不引入新的共享状态或运行顺序。

保持同步/异步行为、成功值、失败值、事务与副作用顺序，以及当前 Result/ResultAsync 边界。结构迁移不顺带改写错误处理或 DAO 契约；迁移暴露的既有不一致须明确记录，并仅修正阻碍本次兼容性或验证的问题。

## 6. 测试与交付策略

逐个服务锁定现有测试行为，迁移实现与测试后运行受影响检查，再进入下一个服务。涉及跨包导入、执行入口或 Desktop 打包脚本时，运行对应消费者的类型检查和现有测试。测试仅使用独立 fixtures 或测试库。

最终至少运行 `bun run --cwd packages/services check-types`、`bun run --cwd packages/services lint`、`bun run --cwd packages/services test`，并按实际改动补充消费者检查、受影响文件格式检查和 `git diff --check`。结构复查使用确认后的 Anatomy 及其组合依赖，核对全部 Service 入口、叶子 spec 和支持模块边界。

完整验证后推送 `codex/ordine-service-structure` 到 `forge-town/ordine` 并创建目标为 `develop` 的 Draft PR。将 PR 附加到当前会话。PR 创建、CI、生产扫描及 Finding 复查是独立证据；本任务不以“已提交 PR”代替“生产问题已解决”。

## 7. 验收标准

| 编号 | 验收条件                                                   |
| ---- | ---------------------------------------------------------- |
| AC01 | 27 个已识别 Service 都在迁移清单中，无重复或遗漏。         |
| AC02 | 工厂函数、依赖注入和公开 API 保持兼容。                    |
| AC03 | 业务行为与现有测试断言保留，真实 LLM 测试入口保留。        |
| AC04 | 必要配置、公共模块与包入口保留，受影响导入完成更新。       |
| AC05 | 测试与叶子实现共置，聚合入口旁无 Service spec。            |
| AC06 | 发布 Draft PR 前完成类型、Lint、测试及结构验证。           |
| AC07 | 合法支持结构的规范边界已审阅与复查。                       |
| AC08 | 从原仓库最新 develop 建立工作分支，PR 指向同仓库 develop。 |
| AC09 | 未全局放宽结构检查策略，叶子实现和 spec 仍必需。           |

## 8. Lean 形式化

词汇版本为 `OrdineServiceMigrationV1`。有限角色、仓库、分支、发布目标、27 个 Service 家族、受保护资产及允许阶段组成唯一规范值 `canonicalDesign`。核心无自由文本语义。

`canonicalDesign_wellFormed` 证明范围、唯一性、发布目标及结构约束良构。允许流程为已规划 → 已迁移 → 已验证 → Draft PR 就绪；后两步要求完整验证证据。每个 AC 对应同编号定理：`AC01_exact_service_scope` 至 `AC09_strict_policy_preserved`；AC03 另由 `AC03_real_llm_entry_points_protected` 明确保护真实 LLM 测试入口。`publication_preserves_migration_invariants` 约束发布保留迁移不变量，`sources_normalize_to_same_design` 证明批准的设计与 Finding 来源归一到同一规范。

配套文件为 `docs/specs/2026-10-06-ordine-service-structure-design.lean`，工具链通过根 `lean-toolchain` 锁定为 `leanprover/lean4:v4.34.0`。实际编译命令为 `lean docs/specs/2026-10-06-ordine-service-structure-design.lean`。形式化证明约束验收规则；实际实现仍须提供测试和结构复查证据。

---

# ordine Service Structure Migration Design

## 1. Goals and Scope

Migrate the 27 Services on the `develop` branch of `forge-town/ordine` to the approved Service unit structure while preserving runtime behavior, factory and dependency-injection contracts, public APIs, and existing test assertions. After migration, no `*.service.spec.ts` sits beside an aggregate Service entry; tests are colocated with concrete business methods or helper implementations.

The current baseline is `03721ab0`. The isolated worktree is `/Users/amin/projects/ordine-service-structure`, on `codex/ordine-service-structure`. The initial inventory contains 88 `*.test.ts` files; this is a migration inventory, not a test-count or coverage target. Production Finding `736ed93b-3d24-45a9-b60f-ab8b24e989ab` groups 166 structural differences: 27 missing-file issues and 139 undeclared-entry issues.

The work also corrects legitimate structural boundaries. Package tooling configuration, release documentation, archived sources, and public execution modules require explicit declarations; necessary files must not be deleted to clear findings. Concrete production Anatomy changes are checked locally before being updated and read back through MCP.

## 2. Non-goals and Alternatives

Do not change business features, authentication or permissions, database tables, error semantics, Pipeline/Agent runtime protocols, or release policy. Retain real LLM tests and their entry points; tests requiring external dependencies that were not run must be reported separately.

The selected approach adopts the shared Service unit structure while retaining required support structures. The alternative keeps the current factory layout and introduces an ordine-specific Anatomy. That reduces migration cost but does not establish the approved Service testing responsibilities, so it was not selected.

## 3. Architecture and Component Boundaries

Service factories retain their existing dependencies and return the same capabilities. The Service implementation assembles dependencies; business methods and helpers move into their own units. Preserve existing Service directory identifiers and public symbols such as `createXxxService` to avoid unrelated renaming.

Service implementations use `<name>.service.ts`. Collection directories use `methods` and `helpers`, as declared by the current production Anatomy, each with an `index.ts`. Method leaves contain an entry, `<method>.method.ts`, and `<method>.method.spec.ts`; helper leaves contain an entry, `<helper>.helper.ts`, and `<helper>.helper.spec.ts`. Move tests according to business responsibility, preserving assertions, fixtures, mocks, and boundary cases. Do not mechanically rename an aggregate test and leave it beside the aggregate entry.

Preserve compatibility of `packages/services/src/index.ts` and the `./execution` and `./execution-migration` subpaths declared in `package.json`. Keep the existing responsibilities of `serviceFactory.ts`, shared errors, and text-import declarations. Update all affected relative imports, barrel exports, build scripts, and public-entry references.

## 4. Support Structures and Specification Boundaries

Protect `vitest.config.ts`, `.oxlintrc.json`, `CHANGELOG.md`, `archived`, and support modules including `canvasExecution`, `execution`, `executionActors`, `executionArtifacts`, `executionGateway`, `executionMigration`, `executionPrompt`, and `jobLease`.

The Service Package Anatomy gains explicit nodes or separate composition rules for identified legitimate support structures. This does not globally allow unknown files. Retain strict `missingRequired`, `unexpectedEntry`, `nameMismatch`, and `nestingMismatch` policies and required Service leaf implementations and tests. Review support-module internals according to their responsibilities rather than applying a business-Service factory template.

Update the Service structure section of `CodeGuidelines.md` so the local authoritative guidelines match the approved structural contract. The user's direct instruction sets the push destination to the original repository, `forge-town/ordine`, and the PR target to that repository's `develop` branch.

## 5. Data Flow and Error Handling

Consumers continue importing factories through public entries, supplying existing dependencies, and invoking the same methods. Extracted methods receive their required dependencies and return the same results. The assembly layer binds dependencies and methods without introducing shared mutable state or execution-order changes.

Preserve synchronous/asynchronous behavior, success and failure values, transaction and side-effect ordering, and existing Result/ResultAsync boundaries. Do not combine structural migration with unrelated error-handling or DAO-contract rewrites. Record existing inconsistencies exposed by migration and fix only those blocking compatibility or validation of this change.

## 6. Testing and Delivery Strategy

For each Service, establish its existing behavior through current tests, migrate implementation and tests, run affected checks, and then proceed to the next Service. Where cross-package imports, execution entries, or Desktop packaging scripts change, run the corresponding consumers' type checks and existing tests. Tests use isolated fixtures or test databases.

Final checks include `bun run --cwd packages/services check-types`, `bun run --cwd packages/services lint`, and `bun run --cwd packages/services test`, plus consumer checks dictated by changes, formatting checks for affected files, and `git diff --check`. Structural review uses the approved Anatomy and composition dependencies to cover all Service entries, leaf specs, and support-module boundaries.

After full validation, push `codex/ordine-service-structure` to `forge-town/ordine` and create a Draft PR targeting `develop`. Attach the PR to this chat. PR creation, CI, production scanning, and Finding review are separate evidence levels; a submitted PR does not establish that the production Finding is resolved.

## 7. Acceptance Criteria

| ID   | Acceptance condition                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| AC01 | All 27 identified Services are included without duplicates or omissions.                                        |
| AC02 | Factory functions, dependency injection, and public APIs remain compatible.                                     |
| AC03 | Business behavior, existing assertions, and real LLM test entry points are preserved.                           |
| AC04 | Required configuration, shared modules, and package entries are retained; affected imports are updated.         |
| AC05 | Tests are colocated with leaf implementations and aggregate entries have no Service spec.                       |
| AC06 | Types, lint, tests, and structure are verified before publishing a Draft PR.                                    |
| AC07 | The legitimate support-structure boundaries are reviewed and checked.                                           |
| AC08 | The work branch starts from the original repository's latest develop; the PR targets that repository's develop. |
| AC09 | Structural policies are not globally weakened; leaf implementations and specs remain required.                  |

## 8. Lean Formalization

The vocabulary version is `OrdineServiceMigrationV1`. Finite roles, repository, branch, publication target, 27 Service families, protected assets, and permitted phases form the unique specification value `canonicalDesign`. The core uses no free-text semantics.

`canonicalDesign_wellFormed` proves scope, uniqueness, publication target, and structural constraints are well formed. The permitted flow is planned → migrated → verified → Draft PR ready; the final two steps require complete verification evidence. Every AC maps to the correspondingly numbered theorem, from `AC01_exact_service_scope` to `AC09_strict_policy_preserved`; AC03 additionally uses `AC03_real_llm_entry_points_protected` to explicitly protect real LLM test entry points. `publication_preserves_migration_invariants` constrains publication to retain migration invariants, while `sources_normalize_to_same_design` proves the approved design and Finding source normalize to the same specification.

The companion file is `docs/specs/2026-10-06-ordine-service-structure-design.lean`. Root `lean-toolchain` pins `leanprover/lean4:v4.34.0`. The actual compilation command is `lean docs/specs/2026-10-06-ordine-service-structure-design.lean`. Formal proofs constrain acceptance rules; the implementation still needs test and structural-review evidence.
