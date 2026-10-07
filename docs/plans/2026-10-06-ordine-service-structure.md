# ordine Service 结构迁移实现计划

> **执行指引：** 推荐使用 subagent-driven-development 技能逐任务执行此计划。
> 步骤使用 checkbox (`- [ ]`) 语法追踪进度。

**目标：** 保留 ordine 的行为、公开工厂 API 和测试覆盖，将 27 个 Service 迁移到确认后的结构规范并提交同仓库 develop Draft PR。

**方案摘要：** 保持工厂和依赖注入契约，把业务方法、辅助逻辑及其现有测试迁移为叶子单元。明确声明合法包配置和支持模块，继续严格检查业务 Service。所有实现变更按服务逐个推进，完成后先做规格审查，再做代码质量审查。

**技术栈：** Bun 1.3.11、TypeScript、Vitest、neverthrow、Zod、Daedalus Anatomy/MCP。

---

### Task 1: 固定基线与验证环境

**文件：**

- 修改范围：仅 `docs/reports/2026-10-06-service-structure/` 中的清单及验证记录。
- 验证入口：`packages/services/package.json`、`packages/services/vitest.config.ts`、`.github/workflows/ci.yml`。

- [x] **Step 1: 安装锁定依赖并保存 Service、测试、公开导出的基线清单。**
- [x] **Step 2: 运行现有 Services 类型、Lint、测试，区分基线失败和环境依赖。**
  - 命令：`bun install --frozen-lockfile`；`bun run --cwd packages/services check-types`；`bun run --cwd packages/services lint`；`bun run --cwd packages/services test`。
  - 预期：得到可核对的基线状态；不连接生产或日常数据库。
- [x] **Step 3: 明确包外相对导入和 Desktop 打包引用。**
  - 完成标准：27 个 Service 和 88 个测试文件全部进入清单，公共子路径与特殊支持模块有独立记录。

### Task 2: 串行迁移 Service 与对应测试

**文件：**

- 修改：`packages/services/src/*Service/**`，覆盖全部 27 个已识别 Service。
- 新建：每个 Service 的 `<name>.service.ts`、`methods/index.ts`、`helpers/index.ts` 及对应叶子实现、入口和 `.spec.ts`。
- 更新：受移动影响的 Services 内部导入，以及 `apps/server/src/`、`apps/desktop-app/scripts/bundle-server.ts` 和其他已识别消费者中的必要引用。
- 测试：迁移相应 `*.unit.test.ts`、`*.integration.test.ts`，保留原断言、fixtures、mock、实际 LLM 执行入口。
- 禁止修改：数据表、DAO 行为、认证与权限、真实模型成功条件、发布流程。

- [x] **Step 1: 按 Service 逐个记录原工厂签名和现有行为测试。**
  - 对每个 Service 先阅读实现及其全部测试；已通过的行为测试作为迁移守卫。
- [x] **Step 2: 提取真实业务方法与辅助责任，Service 只组装原有依赖和方法。**
  - 保留公开函数名、参数、返回类型、闭包共享状态、执行顺序和错误语义。
  - 不将原聚合测试机械移动为一个伪造叶子；测试须归属实际方法或辅助责任。
- [x] **Step 3: 同步导入、导出和现有测试。**
  - Service 目录保持现有标识；使用生产规范中的 `methods`、`helpers`。
  - 叶子包含 `index.ts`、实现以及相邻的对应 `.method.spec.ts` 或 `.helper.spec.ts`。
  - Service 入口旁无 `*.service.spec.ts`；公共包导出及两个 execution 子路径兼容。
- [x] **Step 4: 每个 Service 完成后运行定向测试和类型检查，再进入下一个。**
  - 命令：`bun run --cwd packages/services test src/<service>Service`；`bun run --cwd packages/services check-types`。
  - 预期：迁移前后行为一致，无本次引入的类型错误。
- [x] **Step 5: 对迁移结果做规格一致性审查，再做代码质量审查。**
  - 完成标准：全部 Service 迁移完成；断言与覆盖场景保留；没有通过删除配置、代码或测试消除结构问题。
- [x] **Step 6: 提交已验证实现。**
  - 提交范围：本次迁移与必要消费者更新。
  - 提交信息：`refactor: 迁移 Service 方法与辅助单元结构`。

### Task 3: 保留包公共契约并同步权威规范

**文件：**

- 修改：`CodeGuidelines.md` 的 Service 结构部分。
- 必要更新：`packages/services/src/index.ts`、`packages/services/package.json`、`packages/services/src/serviceFactory.ts`。
- 保护：`packages/services/vitest.config.ts`、`packages/services/.oxlintrc.json`、`packages/services/CHANGELOG.md`、`packages/services/archived/**`、8 个非 Service 支持模块及公共错误和声明文件。

- [x] **Step 1: 对比基线与最终公开导出、工厂签名和执行子路径。**
- [x] **Step 2: 更新本地权威规范，保留包级工具与公共支持结构的职责。**
- [x] **Step 3: 运行实际受影响消费者的类型与现有行为检查。**
  - 命令从相应 `package.json` 和 CI 读取，精确记录成功与未运行项。
- [x] **Step 4: 完成规格审查与代码质量审查后提交。**
  - 提交信息：`docs: 同步 Service 单元与支持结构规范`。

### Task 4: 纠正结构规范边界并复查

**文件与远端对象：**

- 新建：`docs/reports/2026-10-06-service-structure/anatomy-before.json`、`anatomy-proposed.json`、`structural-validation.json`。
- 远端变更：生产 Code Forge 的 Service Package Anatomy `1054274d-005e-4554-84c2-b0459e89c849`。
- 复用：Service 单元 `45015e2f-5c8a-48dc-87ba-9e1accf0fc3e`；Method `c9e8b402-e926-4ba5-b04c-2086a39db531` 与 Helper `824299ac-1cde-47c4-b866-a99a29059ba2` 增加明确的可选独立场景 spec、快照与 PDF 输入模式，保留标准叶子 spec 的必需约束。

- [x] **Step 1: MCP 读取最新 Anatomy，保留完整原定义与 revision。**
- [x] **Step 2: 为合法包配置、公共组合文件和非 Service 支持模块建立明确声明。**
  - 全局四项结构策略继续为 block；业务 Service 的实现和叶子测试继续必需。
  - 支持模块内部不套用业务 Service 模板；已声明的模块边界必须与真实用途一致。
  - 需要 Vitest 文件级 mock 隔离的场景保持独立；可选场景 spec 不替代必需标准 spec，快照与 PDF 输入保留原内容。
- [x] **Step 3: 用真实 Anatomy 检查器验证本地树，并检查对现有 Daedalus Service Package 的影响。**
  - 完成标准：全部业务 Service 符合规则；合法支持结构有明确边界；其他未知根条目仍失败。
- [x] **Step 4: 规格审查、代码质量审查通过后，通过 MCP 保存并回读。**
  - 使用读取到的 revision，发生并发修改时重新评估差异。
  - 提交报告：`docs: 记录 Service 结构复查结果`。

### Task 5: 完整验证与原仓库 Draft PR

**文件：**

- 修改：仅修正此前任务引入的失败。
- 新建：`docs/reports/2026-10-06-service-structure/final-validation.md`。
- PR：`forge-town/ordine` 的 `codex/ordine-service-structure` → `develop`。

- [x] **Step 1: 运行 Services 类型、Lint、全部现有测试以及受影响消费者验证。**
- [x] **Step 2: 格式检查受影响文件、`git diff --check`，以及最终整体代码审查。**
  - 命令：`bunx oxfmt --config packages/oxc-formatter-config/oxfmt.json --check <changed-files>`。
  - 未运行的真实模型、数据库或平台检查单独披露。
- [x] **Step 3: 核对最终分支和用户已有工作，推送原仓库并创建 Draft PR。**
  - 用户明确覆盖 Ordine AGENTS 的 fork 推送限制；不得改推 fork。
  - PR 说明包含结构变化、公开兼容性、测试结果及剩余验证边界。
- [x] **Step 4: 附加 PR，读取 head、base、Draft 状态和 CI，报告实际结果。**
  - Finding 不因 PR 创建自动标为 resolved；不合并或部署。

## 验收追踪

AC01 → Tasks 1、2；AC02–AC05 → Tasks 2、3；AC06 → Task 5；AC07、AC09 → Task 4；AC08 → Tasks 1、5。实现全过程保留类型、行为测试和规范复查证据。
