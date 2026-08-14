---
name: enforce-frontend-code-standards
description: Enforce ORDINE's frontend component, page anatomy, Zustand slice, Refine data-access, semantic HTML, naming, and sample-first refactoring standards. Use when creating, reviewing, or refactoring React/TypeScript pages, list/create flows, stores, shared components, tests, or frontend file names in the ORDINE monorepo.
---

# ORDINE 前端规范守卫

将会议约定落实为代码审查、生成和重构的硬性检查。优先修复违规实现，再报告验证结果；不要只把违规点列出来。

## 工作边界

先阅读仓库根目录的 `AGENTS.md` 和 `CodeGuidelines.md`，再按本 Skill 执行。保留与当前任务无关的脏改动；修改前用 `git status --short` 记录基线。若本 Skill 与用户明确要求冲突，以用户要求为准，并说明偏差。

将以下规则视为默认硬门槛：

- 页面内容区或 Store 直接导入、调用 tRPC 客户端是违规；统一经 Refine 数据层访问。
- 用 `div`、`span` 拼表格是错误；使用原生 `table` 或组件库标准表格组件。
- 跨组件业务状态禁止通过 Props 层层透传；默认从全局 Store 读取。
- 列表页的筛选、表格、分页必须是平级抽象，由页面内容层统一组装。
- CRUD 场景优先复用 Refine，不重复自研同类数据访问和状态抽象。
- 发现可直接修复的违规代码时直接修复，不因代码由 AI 生成而降低标准。

## 执行流程

### 1. 建立参照物

定位目标页面所属的路由、Refine resource/dataProvider、Store、共享组件和测试。优先选择一个符合度最高的 `create` 页面作为样板；若任务是列表页且没有合适的 create 页面，则选择同类中结构最完整的页面。先把样板打磨到完整，再让其他页面逐项对齐。

不要一次性改造整个项目：按页面或功能切片渐进重构。每一轮都保持可运行、可验证；中途暂停时列出已完成规则和剩余差距。

### 2. 组织页面与组件

遵循 `Wrapper → Content → Store` 的页面边界：

- Wrapper 只负责 Provider、依赖注入和布局组装。
- Content 只负责当前页面视觉结构和交互编排，从 Store/Refine 边界读取数据。
- 一个视觉块对应一个有语义的独立组件；删除只为占位或分块而存在的无意义 `div`。
- 通用组件在页面层做具体化封装，把当前页面所需配置集中在当前层；不要把页面业务逻辑塞回通用组件。
- 列表页按同一层级拼装 `Filter`、`Table`、`Pagination`；不要将筛选或分页隐藏在表格组件内部。
- 表格必须保留正确的 `table`、`thead`、`tbody`、`tr`、`th`、`td` 语义，或使用项目组件库的标准表格组件。

### 3. 设计 Store 与数据流

按独立功能切片拆分 Store，例如 `filterSlice`、`tableSlice`、`modalSlice`；不要把页面全部业务状态堆进一个大 slice。只有当不同页面的同类 slice 逻辑完全一致时，才抽取通用 slice。

- 将跨组件共享状态放入 Zustand Store；只在单组件内部使用的短生命周期 UI 状态留在组件本地。
- 禁止业务 Props Drilling。能从页面 Store 或 Refine 上下文读取的状态，不再由父组件逐层传递。
- Store 不得导入或调用 tRPC，不得把网络请求实现藏进 Store action。
- 页面内容区不得直接调用 tRPC 客户端、裸 `useQuery`/`queryFn` 数据请求或手写 CRUD 请求。
- 使用项目已有的 Refine DataProvider 与 hooks（如 `useList`、`useOne`、`useCreate`、`useUpdate`、`useDelete`、`useTable`）；先确认当前项目的 resource 命名和封装方式。
- Store 只接收、保存和更新已经过数据层处理的状态；不要为了绕开 Refine 复制一套数据访问层。

涉及前后端联动时，遵循 `Schema → DAO → Service → tRPC → Refine → UI` 的链路。若 Refine resource 或 dataProvider 不足，先补齐对应边界，再改页面。

### 4. 落地重构

先完成一个标准样板页面的结构、Store、Refine 数据流和测试，再批量让同类页面按样板对齐。测试用例可从样板复制后按 resource、字段和交互替换；不要机械复制错误实现。

重构时按以下顺序检查：

1. 页面目录和 Wrapper/Content/Store 边界。
2. 视觉块与语义化 HTML。
3. Filter/Table/Pagination 的平级关系。
4. Store slice 的职责和共享范围。
5. Refine resource、hooks、mutations 与错误/加载状态。
6. 测试、命名和格式化。

不要追求一次重构完美；每一轮只扩大到能被当前验证覆盖的范围，并保留清晰的后续清单。

### 5. 统一文件命名

为新文件使用范畴中缀，让搜索结果能直接暴露类型错误。遵循仓库既有大小写与扩展名约定，在最终扩展名前插入范畴标识：

- 路由/过程类代码：`user.procedure.ts`。
- 单元或组件测试：`user.spec.ts`。
- 端到端测试：`user.e2e.spec.ts`。

不要为了改名扩大任务范围；仅在新增文件或当前重构明确包含命名清理时迁移，并同步所有 import、测试和配置引用。双中缀优先用于能显著区分测试层级的场景。

## 验收清单

完成后提供文件、符号、命令和退出状态等证据，并逐项检查：

- [ ] 已阅读 `AGENTS.md`、`CodeGuidelines.md`，并识别样板页面。
- [ ] 视觉块有独立组件；没有无意义分隔 `div`。
- [ ] 表格使用语义化 HTML 或标准表格组件。
- [ ] 列表页的筛选、表格、分页是平级组件。
- [ ] 跨组件状态不经 Props Drilling；Store 已按功能切片。
- [ ] 页面和 Store 中没有直接 tRPC 调用；CRUD 走 Refine。
- [ ] 相同逻辑才抽通用 slice，未引入过度抽象。
- [ ] 样板页面测试已复用并按实际字段/交互校正。
- [ ] 新增文件遵循中缀/双中缀命名。
- [ ] 运行受影响包的测试、类型检查、lint/format；UI 变更补浏览器验证。
- [ ] 运行 `git diff --check`；若仓库全量检查被历史基线阻塞，区分报告基线与本次改动结果。

优先使用与改动范围匹配的验证命令，例如：

```powershell
rg -n "from ['\"].*trpc|\btrpc\.|useQuery\(|queryFn:" apps/app/src/pages apps/app/src -g '*.ts' -g '*.tsx'
bun run quality
bun run format:check
git diff --check
```

静态搜索结果需要人工判断：Refine 内部实现或服务端 tRPC 路由不属于页面/Store 违规。任何非零退出码都必须如实报告，不能将“命令已启动”写成“检查通过”。

## 交付格式

用以下结构简要汇报：

1. **已对齐**：列出修改文件及对应规则。
2. **验证证据**：列出命令、最终退出状态和关键结果。
3. **剩余问题**：区分本次引入、既有基线、环境/权限阻塞。
