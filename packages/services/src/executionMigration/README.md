# R11 离线手工重建与原子导入

本模块只导入产品明确选择、重新定义的 v2 Operation/Pipeline。它不解释或执行旧协议，不声称旧代码无损转换，也不修改旧数据库。历史 Job、审批、Trace、会话、产物和 runtime 配置只在只读归档中保留。新的执行凭据应在切换后通过产品配置与重新授权获得。

`MigrationSourceSchema` 和 `ExecutionMigrationBundleSchema` 是输入格式唯一契约。模块不挂入 API、MCP 或常规执行 service。

## 输入与产品决策

1. 冻结并归档旧实例，独立核对备份、产物和任务状态。制作 UTF-8 SourceExport 文件。外层必须是 `ordine-legacy-offline-export/1`，包含旧版本、旧 workspace、时间、停止写入声明和凭据检查声明。`objects` 中每项是 `{ kind, id, data }`，`data` 保存该旧对象完整 JSON 字段。导出完整性、真实停止写入及实际备份恢复需要外部切换证据；本工具不会因 `writesStopped: true` 自报字段而声称已验证现场停止。
2. 不把明文凭据写进普通 SourceExport 或 bundle。原始含凭据备份只保存在受控归档中；应先由导出者明确隔离凭据并另行记录原始归档 hash 与脱敏处置，而不能悄悄把不安全原始备份当作本工具的安全输入。工具拒绝已知凭据字段、Bearer、常见 token、私钥及带密码 URL。任意文本中的秘密无法自动完全识别，声明与人工审计仍然必须执行。
3. bundle 固定 `strategy: "manual_rebuilt"`。`sourceSha256` 是 SourceExport **文件原始字节**的 SHA-256；每个 `sourceObjectSha256` 是 `@repo/models.hashExecutionJson({kind,id,data})` 的 canonical JSON SHA-256。产品在 `selected` 中列出考虑保留的旧 Operation/Pipeline ID，并在 `decisionBy/decidedAt` 留下决定记录。
4. 每个源对象必须恰有一个 `objects` 决定：`rebuilt`、`rejected`、`manual_required`、`archive_only`，理由和警告必须显式提供。被选择但仍 `manual_required` 的对象阻止整个 bundle 导入；明确拒绝/归档的选择会保留在报告中。未选择对象不可生成新定义。
5. 每个旧对象的每一个叶字段都必须有 `fieldDispositions: [{path, action, reason}]`。`path` 使用 RFC 6901 JSON Pointer，空数组/空对象也算叶节点。可以调用 `migrationLeafPaths(data)` 生成路径清单，再逐字段填入产品决定；父路径不能代替子路径，遗漏、重复、虚构路径均拒绝。`rebuilt` 不是等价承诺；`discarded` 和 `archived` 必须说明明确处置。自定义未知旧字段同样必须记录。
6. `rebuilt` 对象提供 `{newId,revision:1}` 的 mapping，且对应一份严格 v2 OperationRevision 或 PipelineDefinition。目标 ID 必须全新，不能复用本批源 ID；每份目标只能对应一个源对象。现阶段一对多/多对一重建不支持，需重新做产品拆分选择，不能伪造映射。
7. 检测到 compound/children/subgraph 时，必须声明 `explicitly_rebuilt` 或 `archived_without_execution` 并逐字段给出理由；工具不会展开旧 compound。活跃或未知状态 Job/审批一律拒绝。历史 `done` 仅允许保留在归档决定中，不能导入成新 `succeeded`。
8. Operation 由 `validateOperationDefinition` 验证；每张图使用精确 immutable pins 经 `compileDefinitionGraph` 验证节点、边、端口、类型、循环与引用。未导入的 runtime、skill、capability 和 materialize_file asset 引用不能混入此路径，应另行重新授权并创建新 revision。手工脚本/agent 指令的实际效果仍需后续执行验收。

所有 JSON 对象键必须唯一，包括 Unicode 转义后的等价键；文件必须为合法 UTF-8，大小/复杂度受限。新增未说明的 v2 字段会被 strict schema 拒绝。

## 示例与运行

仓库根目录用 Bun 生成一个完整、可编辑的合成例子（输出目录必须显式且文件不能已存在）：

```powershell
bun packages/services/src/executionMigration/tests/writeExample.ts D:\r11-review
```

例子有两个明确重建对象、一个旧 done Job 归档、一个 compound 拒绝；其中未知旧字段被产品显式放弃。它只是工具示例，不代表已选择任何真实用户数据。

只验证，不打开任何数据库：

```powershell
bun apps/create/src/executionImport.ts --source D:\r11-review\r11-offline-rebuild-source.example.json --bundle D:\r11-review\r11-offline-rebuild-bundle.example.json --report D:\r11-review\validation.json --workspace new-workspace
```

审查源 hash、映射、决定、逐图检查和手工重建内容后，明确选择全新数据库或专属新 schema。优先将数据库 URL 保存在环境变量中，避免 shell 历史携带凭据：

```powershell
# R11_IMPORT_DATABASE_URL 由本机安全配置提供，不能引用旧/生产数据库。
bun apps/create/src/executionImport.ts --import --confirm-new-workspace --database-url-env R11_IMPORT_DATABASE_URL --schema execution_rebuilt_20260908 --source D:\r11-review\r11-offline-rebuild-source.example.json --bundle D:\r11-review\r11-offline-rebuild-bundle.example.json --report D:\r11-review\import.json --workspace new-workspace
```

`--source`、`--bundle`、`--report` 均要求互异的显式绝对路径；报告文件不能已存在。`--workspace` 必须等于 bundle 目标 workspace；URL、schema、workspace 都没有环境自动默认值。`--database-url` 也可显式使用，但与 `--database-url-env` 互斥。`public` 和 `pg_*` schema 被拒绝。生产导入需按完整切换授权执行，本示例不授权生产写入。

## 原子性与报告

CLI 使用 `createExecutionDatabase(initialize:true)` 验证冻结 SQL hash/DDL marker；普通旧库或混合表 schema 不能被采用。Repository 再检查当前 schema、精确 14 表+marker 清单和 SQL hash，按固定顺序持有所有表的排他锁，在锁内确认 **全部执行表为空**，再复用单表 DAO 写入 Operation heads/revisions/Pipelines。中途失败整个事务回滚。并发导入最多一个成功，后续导入因非空拒绝。工具不清空目标，不覆写已有定义，也不生成 Job/artifact/runtime 行。

验证报告包含源文件 hash、normalized bundle hash、bundle 文件 hash（CLI）、目标 workspace、逐对象旧 hash/决定/映射/字段数量/警告数量、逐图节点边数及 immutable pins。自由文本理由和警告留在受审查 bundle 中；报告不回显任意原始内容以减少敏感信息泄露。报告明确区分冻结声明、凭据模式扫描、语义未证明、实际导入提交。

CLI 先以独占创建方式预留 `import_pending` 报告，再打开数据库和导入，提交后改为 `committed`。数据库事务与文件系统报告无法组成一个分布式事务；进程终止或报告最终写入失败可能留下 pending 报告，而数据库已经完整提交。此时需只读核查数据库及 bundle hashes，不能删除已有目标重试。成功导入后，下一阶段再配置 runtime、重新授权和运行选定 Pipeline，执行成功与产物交付不能由离线结构验证代替。

## 可复验命令

在 `packages/services` 运行：

```powershell
$env:R11_DATABASE_URL='postgres://postgres@127.0.0.1:36435/ordine_pipeline_v2_r5'
$env:R11_REPORT_DIRECTORY='D:\Coding\项目ORDINE\outputs\pipeline-v2-implementation'
bun x vitest run src/executionMigration/tests/validateExecutionMigration.test.ts src/executionMigration/tests/importExecutionMigration.integration.test.ts
```

数据库测试硬限制到上面的独立 DB/端口，仅创建并清理随机 `r11_<uuid>` schema。未设置该 URL 时集成测试明确 skip，不能把 skip 当作验收通过。
