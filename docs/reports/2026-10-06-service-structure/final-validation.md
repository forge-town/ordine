# Ordine Service 结构迁移最终验证

日期：2026-10-07（Asia/Singapore）

## 已完成

- 从 `forge-town/ordine` 最新 `develop` 基线 `03721ab082172699479690714b15c342c0144382` 创建 `codex/ordine-service-structure`。
- 27 个 Service 全部使用 `<name>.service.ts` 薄组装入口，并将真实方法与辅助职责放入 `methods/`、`helpers/` 叶子；每个叶子保留 `index.ts`、实现和 canonical spec。
- 保留原公共入口及两个 execution 子路径。公开 API guard：`src/index.ts` 182、`src/execution/index.ts` 44、`src/executionMigration/index.ts` 12，符号、值/类型角色和参数声明均未变化。
- 原 27 个 Service 的测试断言 AST 保留检查无缺失；快照和 PDF fixture SHA-256 与基线一致。
- 真实 Anatomy 检查器：`conforms=true`、`block=0`、`warn=0`、`allow=61`；27 个 Service scope 保留，未知根/符号链接/叶子/资产负例仍 block。
- Daedalus Code Forge 保存并回读：Service Package revision 2、Service Method revision 2、Service Helper revision 2；既有 Service Unit revision 7 保持不变。保存前读取了全部四个对象并使用 expectedRevision，未发生并发覆盖。

## 验证结果

- `ORDINE_EXECUTION_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:36435/ordine_pipeline_v2_r5 bun run --cwd packages/services test -- --run`：519 个测试文件通过、7 个原场景跳过；1161 个测试通过、26 个跳过。
- `bun run check-types`：24/24 workspace packages 通过。
- `bun run lint`：21/21 workspace packages 通过，只有既有 warning，无 error。
- `apps/create` 类型检查、lint、`build:cli` 通过；`apps/server` 类型检查、lint 通过；`apps/desktop-app` 类型检查及 `bundle-server` 通过；`apps/app` 类型检查、lint、build 通过。
- 受影响文件格式检查和 `git diff --check` 通过。
- 独立规格审查：`full-spec-review.md`，PASS_CHECKPOINT。
- 独立质量审查：`full-quality-review.md`，PASS_CHECKPOINT。

## 未验证边界

真实 Windows runtime、真实模型/实时 Codex、生产数据库、生产部署、CI 远端执行和浏览器端业务验收未在本任务中宣称通过。Execution 数据库验证只使用项目专属 Docker PostgreSQL `127.0.0.1:36435/ordine_pipeline_v2_r5`；未操作日常数据库。Finding `736ed93b-3d24-45a9-b60f-ab8b24e989ab` 保持 pending，不因本地 PR 工作自动关闭。
