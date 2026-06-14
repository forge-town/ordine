# CLAUDE.md — 施工执行规则（长期有效）

> 项目规范见 [AGENTS.md](./AGENTS.md) 与 [CodeGuidelines.md](./CodeGuidelines.md)。本文件约定**施工计划与执行纪律**，对所有重构/新功能工程生效。
> 当前生效的施工计划：`docs/ordine-agent-bar重构手册v3.md`（N11–N16）。

## 一、施工计划的颗粒度标准

任何施工计划（手册）必须达到以下颗粒度才允许开工：

1. **任务编号制**：沿用 N 系列编号（`N<期>-<序>`），按序执行；一个任务 = 一次 commit 的工作量（约 0.5–1 天内可完成、可独立验收）。
2. **证据级现状审查**：改什么必须给出 `文件路径:行号` 级证据，不允许"大概在某处"。
3. **每任务四要素**：改动文件清单、具体做法（schema → DAO → Service → tRPC → 前端的施工顺序）、验收标准（可执行：单测/手测步骤/快照对比）、涉及的 schema 与 i18n 变更。
4. **行数预算**：新文件/目录给出单文件行数上限（默认 ~200 行红线）。
5. **特别警告区**：列出执行中容易走偏的方向（如伪造进度、绕过校验链），违反 = 返工。
6. **最终验收清单**：一期一张可勾选清单，合并前必须全过。

## 二、提交纪律

- **一任务一 commit**，格式：`<type>: <中文描述> (N11-01)`；类型沿用 Conventional Commits。
- commit 前质量门：宿主机环境跑 `bun run format` → `bun run quality` 全绿。**Cowork 沙盒环境例外**（见 §四）：沙盒内每 commit 过 `tsc --noEmit`（受影响包），vitest/oxlint/oxfmt 在**期末由用户在宿主机集中跑一次**，发现的问题以 fix commit 补齐后才算该期完成。
- 迁移类改动（移动代码、零行为变化）与行为改造**绝不混在同一个 commit**。
- 新组件硬性要求：useTranslation（en+zh 同步加键）+ story + data-testid。
- UI 受影响的任务：浏览器目检 + 截图存 `pr-assets/`。

## 三、一期工程完成后的真实验证（硬性）

每完成一期（一个 N 编号段，如 N11 全部任务），**必须用 computer use / 浏览器工具真实跑一遍**，不允许只靠单测绿就收工：

1. 启动应用（`ORDINE_LOCAL_MODE=true bun run dev`），在真实浏览器里把该期的主路径逐条走通（对照该期的整体验收条目）。
2. 涉及 LLM 的功能必须**真模型手测**（prompt 改动单测绿 ≠ 提案质量好），记录输入/输出。
3. 同时回归相关联的既有路径（如改了 Agent Bar，则回归：新建 pipeline → proposal → Apply → Run 主链路）。
4. 跑相关测试套件：受影响包的单元测试 + 可用的 E2E。
5. 验证证据（截图/录屏 + 结论）存 `pr-assets/`，未通过的项记入手册遗留清单，不许静默跳过。

## 四、本仓库已知环境事项

- **Cowork 沙盒限制**：沙盒为 Linux arm64，node_modules 原生二进制是 macOS 版（vitest 的 rolldown、oxlint、oxfmt 均无法运行），npm registry 被网络策略拦截无法补装；bun 不可安装。沙盒内可用：node 22、tsc（纯 JS）、git。质量门按 §二 的例外规则执行（已与用户确认：期末集中跑）。
- 工作树曾出现残留 `.git/index.lock`，git 写操作失败时先检查并删除。
- 全量 `bun run build` 的 Nitro 问题、E2E login 超时等见 AGENTS.md §六。
