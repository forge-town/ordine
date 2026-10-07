# Service 结构迁移基线

基线提交：`03721ab082172699479690714b15c342c0144382`，原仓库 `forge-town/ordine` 的 `develop`。实施工作树为 `/Users/amin/projects/ordine-service-structure`，分支为 `codex/ordine-service-structure`。

锁定依赖安装成功。清单记录 27 个 Service、`src` 中 88 个测试文件及 267 个源文件的 SHA-256；Vitest 还收集了 `archived` 中的 5 个历史测试文件，共 93 个文件。

Services 类型检查与 Lint 通过，Lint 存在原有 warning。首次全量测试有 85 个文件通过、6 个文件跳过、2 个文件失败；测试用例为 767 通过、26 跳过、2 超时。失败发生在迁移前：

- executionRuntime 集成测试要求显式指定隔离数据库，未设置时主动拒绝运行。本任务新建独立 Docker 测试数据库后，原 6 个用例通过。
- Agent Run shutdown 两个用例使用硬编码 Windows 可执行路径。macOS 的 `node:path.isAbsolute("C:/fake/codex.exe")` 返回 false，运行时解析提前失败，测试等待的 actor/resume 事件不会发生。迁移时只修正 mock 路径，保留原断言、超时限制与业务路径校验。
- 另两个原有产品数据库集成文件在独立产品测试库中运行，3 个用例通过。新库单独应用 14 份既有 SQL migration；未操作日常或生产数据库。

公开包入口为 `src/index.ts`、`src/execution/index.ts` 和 `src/executionMigration/index.ts`，对应 `@repo/services`、`@repo/services/execution` 和 `@repo/services/execution-migration`。必要消费者包括 server 的执行组合与外部验证脚本，以及 create 的导入脚本。Desktop 打包直接复制 `src/executionActors`，该支持模块保持原位置。

真实 Anatomy 检查器复现原 Finding：166 个 block、0 个 warn、0 个 allow。规范修订需显式声明包配置及支持模块，并保持未知根条目、未知叶子条目与缺失标准叶子 spec 的阻断验证。

原有真实模型及 Windows 场景的开关和断言必须保留。跳过的外部依赖场景不计为通过；最终结果以迁移后的完整验证为准。
