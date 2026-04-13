/**
 * Seed: Checklist Items
 *
 * Seeds the `checklist_items` table with verification items for each best practice.
 * Each best practice gets 3-6 actionable check items.
 */

import { apiPut } from "../api";

interface ChecklistItemSeed {
  id: string;
  bestPracticeId: string;
  title: string;
  description: string;
  checkType: "script" | "llm";
  sortOrder: number;
}

// ─── Checklist Items Data ────────────────────────────────────────────────────

const CHECKLIST_ITEMS: ChecklistItemSeed[] = [
  // ── bp_barrel_export ───────────────────────────────────────────────────────
  { id: "cl_barrel_1", bestPracticeId: "bp_barrel_export", title: "index.ts 仅包含 export * from 语句", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_barrel_2", bestPracticeId: "bp_barrel_export", title: "无业务逻辑、函数、变量、类定义", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_barrel_3", bestPracticeId: "bp_barrel_export", title: "禁止 export default", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_barrel_4", bestPracticeId: "bp_barrel_export", title: "使用相对路径，禁止别名路径（@/）", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_barrel_5", bestPracticeId: "bp_barrel_export", title: "导出项与实际文件一一对应，无重复导出", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_barrel_6", bestPracticeId: "bp_barrel_export", title: "无循环依赖", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_checklist ───────────────────────────────────────────────────────────
  { id: "cl_checklist_1", bestPracticeId: "bp_checklist", title: "每条规则可回答 Yes/No，禁止模糊表述", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_checklist_2", bestPracticeId: "bp_checklist", title: "每条至少附一个正确或错误示例", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_checklist_3", bestPracticeId: "bp_checklist", title: "使用编号格式（如 1.1、2.3）", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_checklist_4", bestPracticeId: "bp_checklist", title: "包含 Bad Case 确认节", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_checklist_5", bestPracticeId: "bp_checklist", title: "条目总数 ≤ 30，每节 ≤ 8 条", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_checklist_6", bestPracticeId: "bp_checklist", title: "禁止使用「应该」「需要」「建议」等模糊词", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_component_design ────────────────────────────────────────────────────
  { id: "cl_comp_design_1", bestPracticeId: "bp_component_design", title: "组件有明确的单一职责", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_comp_design_2", bestPracticeId: "bp_component_design", title: "使用组合替代配置驱动", description: "禁止 tabs={[...]} 模式", checkType: "llm", sortOrder: 1 },
  { id: "cl_comp_design_3", bestPracticeId: "bp_component_design", title: "Props 继承 HTML 属性，最小化自定义 Props", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_comp_design_4", bestPracticeId: "bp_component_design", title: "提供 className 扩展点，用 cn() 合并", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_comp_design_5", bestPracticeId: "bp_component_design", title: "使用命名导出而非默认导出", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_comp_design_6", bestPracticeId: "bp_component_design", title: "不存在 God Component 或与业务耦合的 UI 组件", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_component_unit ──────────────────────────────────────────────────────
  { id: "cl_comp_unit_1", bestPracticeId: "bp_component_unit", title: "组件以独立文件夹形式存在（PascalCase）", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_comp_unit_2", bestPracticeId: "bp_component_unit", title: "文件夹内包含 index.ts 桶导出文件", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_comp_unit_3", bestPracticeId: "bp_component_unit", title: "包含 ComponentName.test.tsx 单元测试文件", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_comp_unit_4", bestPracticeId: "bp_component_unit", title: "包含 ComponentName.stories.tsx 故事文件", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_comp_unit_5", bestPracticeId: "bp_component_unit", title: "只导出一个主组件", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_comp_unit_6", bestPracticeId: "bp_component_unit", title: "测试和故事文件与组件同目录", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_dao ─────────────────────────────────────────────────────────────────
  { id: "cl_dao_1", bestPracticeId: "bp_dao", title: "文件位于 models/daos/，命名 {feature}Dao.ts", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_dao_2", bestPracticeId: "bp_dao", title: "类型用 $inferSelect/$inferInsert 推导", description: "禁止手写", checkType: "llm", sortOrder: 1 },
  { id: "cl_dao_3", bestPracticeId: "bp_dao", title: "写方法必须同时提供 WithTx 变体", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_dao_4", bestPracticeId: "bp_dao", title: "查询单条返回 T | null，多条返回 T[]", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_dao_5", bestPracticeId: "bp_dao", title: "create/update 使用 .returning() 返回行", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_dao_6", bestPracticeId: "bp_dao", title: "DAO 内禁止 try-catch、db.transaction()、调用其他 DAO", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_db_table ────────────────────────────────────────────────────────────
  { id: "cl_db_table_1", bestPracticeId: "bp_db_table", title: "SQL 表名全小写 + 下划线分隔 + 英文复数", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_db_table_2", bestPracticeId: "bp_db_table", title: "文件名格式 {sql_tablename}_table.ts", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_db_table_3", bestPracticeId: "bp_db_table", title: "TS 变量名 {sqlTableName}Table（camelCase + Table 后缀）", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_db_table_4", bestPracticeId: "bp_db_table", title: "SQL 列名 snake_case，TS 键名 camelCase", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_db_table_5", bestPracticeId: "bp_db_table", title: "无无意义后缀（_data、_info、_tbl）", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_db_table_6", bestPracticeId: "bp_db_table", title: "pgTable 第一参数与文件名去 _table.ts 部分一致", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_error_handling ──────────────────────────────────────────────────────
  { id: "cl_error_1", bestPracticeId: "bp_error_handling", title: "必须使用 neverthrow，禁止原生 try-catch", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_error_2", bestPracticeId: "bp_error_handling", title: "可能失败的函数返回 Result<T, E> 或 ResultAsync", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_error_3", bestPracticeId: "bp_error_handling", title: "调用方必须处理错误（match/map/mapErr）", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_error_4", bestPracticeId: "bp_error_handling", title: "定义具体错误类，禁止 err(\"string\")", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_error_5", bestPracticeId: "bp_error_handling", title: "使用 andThen 组合多个可能失败的操作", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_error_6", bestPracticeId: "bp_error_handling", title: "不存在忽略 Result 或返回裸值的函数", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_form ────────────────────────────────────────────────────────────────
  { id: "cl_form_1", bestPracticeId: "bp_form", title: "表单状态由 react-hook-form 管理，禁止 useState", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_form_2", bestPracticeId: "bp_form", title: "使用 zodResolver 集成 Zod 校验", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_form_3", bestPracticeId: "bp_form", title: "字段通过 render={({ field }) => ...} 接入", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_form_4", bestPracticeId: "bp_form", title: "defaultValues 使用深拷贝副本", description: "禁止传引用", checkType: "llm", sortOrder: 3 },
  { id: "cl_form_5", bestPracticeId: "bp_form", title: "跨子组件用 FormProvider + useFormContext", description: "禁止传 control", checkType: "llm", sortOrder: 4 },
  { id: "cl_form_6", bestPracticeId: "bp_form", title: "表单是独立沙盒，仅在 onSubmit 时对外输出", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_i18n ────────────────────────────────────────────────────────────────
  { id: "cl_i18n_1", bestPracticeId: "bp_i18n", title: "使用 LanguageDetector + initReactI18next 初始化", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_i18n_2", bestPracticeId: "bp_i18n", title: "fallbackLng 已配置，escapeValue 为 false", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_i18n_3", bestPracticeId: "bp_i18n", title: "翻译文件位于 src/locales/，key 按模块分组 camelCase", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_i18n_4", bestPracticeId: "bp_i18n", title: "组件中用 useTranslation() 获取 t 函数", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_i18n_5", bestPracticeId: "bp_i18n", title: "富文本用 <Trans> 组件，禁止 dangerouslySetInnerHTML", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_i18n_6", bestPracticeId: "bp_i18n", title: "所有语言文件 key 结构完全一致（镜像关系）", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_one_component_per_file ──────────────────────────────────────────────
  { id: "cl_one_comp_1", bestPracticeId: "bp_one_component_per_file", title: "每个 .tsx/.jsx 文件只有一个导出组件", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_one_comp_2", bestPracticeId: "bp_one_component_per_file", title: "拆分出的文件名与组件名一致（PascalCase）", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_one_comp_3", bestPracticeId: "bp_one_component_per_file", title: "子组件定义已从父组件中移除，改为 import", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_one_comp_4", bestPracticeId: "bp_one_component_per_file", title: "index.ts 桶导出已同步更新", description: "", checkType: "llm", sortOrder: 3 },

  // ── bp_page ────────────────────────────────────────────────────────────────
  { id: "cl_page_1", bestPracticeId: "bp_page", title: "页面为独立目录，PascalCase 命名", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_page_2", bestPracticeId: "bp_page", title: "包含 Wrapper 文件（{PageName}.tsx）", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_page_3", bestPracticeId: "bp_page", title: "包含 Content 文件（{PageName}Content.tsx）", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_page_4", bestPracticeId: "bp_page", title: "有状态管理时 _store/ 目录包含 slice + store + provider", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_page_5", bestPracticeId: "bp_page", title: "Wrapper 只负责组装和依赖注入，不含 UI 逻辑", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_refine_trpc ─────────────────────────────────────────────────────────
  { id: "cl_refine_1", bestPracticeId: "bp_refine_trpc", title: "组件中禁止直接调用 trpc.xxx.useQuery/useMutation", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_refine_2", bestPracticeId: "bp_refine_trpc", title: "读取数据使用 useList/useOne/useInfiniteList", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_refine_3", bestPracticeId: "bp_refine_trpc", title: "写入数据使用 useCreate/useUpdate/useDelete", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_refine_4", bestPracticeId: "bp_refine_trpc", title: "禁止直接 import @tanstack/react-query 获取数据", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_refine_5", bestPracticeId: "bp_refine_trpc", title: "扩展需求走 DataProvider，不绕过 Refine", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_repository ──────────────────────────────────────────────────────────
  { id: "cl_repo_1", bestPracticeId: "bp_repository", title: "Repository 只在跨表写入时创建", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_repo_2", bestPracticeId: "bp_repository", title: "多表写入必须包裹 db.transaction()", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_repo_3", bestPracticeId: "bp_repository", title: "事务内调用 DAO 的 WithTx 变体方法", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_repo_4", bestPracticeId: "bp_repository", title: "只返回 { id: string }，不返回完整业务对象", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_repo_5", bestPracticeId: "bp_repository", title: "不包含业务规则判断（属于 Service 层）", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_schema ──────────────────────────────────────────────────────────────
  { id: "cl_schema_1", bestPracticeId: "bp_schema", title: "每个 Schema 一个独立文件，文件名 = Schema 名", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_schema_2", bestPracticeId: "bp_schema", title: "TypeScript 类型必须用 z.infer<> 派生", description: "禁止手写 interface", checkType: "llm", sortOrder: 1 },
  { id: "cl_schema_3", bestPracticeId: "bp_schema", title: "表结构 Schema: {TableName}Schema", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_schema_4", bestPracticeId: "bp_schema", title: "输入 Schema: {Action}{Feature}InputSchema", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_schema_5", bestPracticeId: "bp_schema", title: "DAO 层不定义 Zod Schema，用 $inferSelect/$inferInsert", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_service ─────────────────────────────────────────────────────────────
  { id: "cl_service_1", bestPracticeId: "bp_service", title: "文件位于 services/，命名 {feature}Service.ts", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_service_2", bestPracticeId: "bp_service", title: "严禁直接 import db 做普通查询，通过 DAO 操作", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_service_3", bestPracticeId: "bp_service", title: "方法返回类型明确声明 Promise<T>", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_service_4", bestPracticeId: "bp_service", title: "业务规则在 Service 层处理，不下沉到 DAO", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_service_5", bestPracticeId: "bp_service", title: "不使用 any 类型", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_skill ───────────────────────────────────────────────────────────────
  { id: "cl_skill_1", bestPracticeId: "bp_skill", title: "目录名全小写+连字符，无赘余 -skill 后缀", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_skill_2", bestPracticeId: "bp_skill", title: "SKILL.md 前言区含 name 和 description", description: "name 必须等于目录名", checkType: "llm", sortOrder: 1 },
  { id: "cl_skill_3", bestPracticeId: "bp_skill", title: "description 100-150 字符，单行", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_skill_4", bestPracticeId: "bp_skill", title: "best-practice 类以 Must follow 开头", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_skill_5", bestPracticeId: "bp_skill", title: "SKILL.md 正文 ≤ 20 行，细节放 references/", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_skill_6", bestPracticeId: "bp_skill", title: "best-practice 类必须有 checklist.md 和 best-practice-examples/", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_store ───────────────────────────────────────────────────────────────
  { id: "cl_store_1", bestPracticeId: "bp_store", title: "Store 位于页面 _store/ 目录", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_store_2", bestPracticeId: "bp_store", title: "Slice 文件 {name}Slice.ts，Store 文件 {name}Store.ts", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_store_3", bestPracticeId: "bp_store", title: "不包含 loading/error 等异步状态字段", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_store_4", bestPracticeId: "bp_store", title: "Slice 只含同步状态修改，无副作用", description: "禁止 fetch/toast/DOM", checkType: "llm", sortOrder: 3 },
  { id: "cl_store_5", bestPracticeId: "bp_store", title: "方法命名 handle{Action}，不用 set{Field}", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_store_6", bestPracticeId: "bp_store", title: "Provider 在 Wrapper 组件中使用", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_storybook ───────────────────────────────────────────────────────────
  { id: "cl_storybook_1", bestPracticeId: "bp_storybook", title: "stories 文件与组件同目录", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_storybook_2", bestPracticeId: "bp_storybook", title: "使用 CSF3 格式，title 为 Components/{Name}", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_storybook_3", bestPracticeId: "bp_storybook", title: "包含 Base 和 Default 故事", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_storybook_4", bestPracticeId: "bp_storybook", title: "回调 props 使用 fn()，禁止箭头函数", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_storybook_5", bestPracticeId: "bp_storybook", title: "禁止无意义占位符，使用中文业务数据", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_svg_icon ────────────────────────────────────────────────────────────
  { id: "cl_svg_1", bestPracticeId: "bp_svg_icon", title: "所有 SVG 封装为独立 .tsx 存放于 icons/", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_svg_2", bestPracticeId: "bp_svg_icon", title: "文件名 PascalCase 以 Icon 结尾", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_svg_3", bestPracticeId: "bp_svg_icon", title: "使用 SVGProps<SVGSVGElement>，属性可覆盖", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_svg_4", bestPracticeId: "bp_svg_icon", title: "具名导出，禁止 default export", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_svg_5", bestPracticeId: "bp_svg_icon", title: "icons/index.ts 统一桶导出所有图标", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_svg_6", bestPracticeId: "bp_svg_icon", title: "业务组件内不存在内联 <svg> 标签", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_ui_components ───────────────────────────────────────────────────────
  { id: "cl_ui_comp_1", bestPracticeId: "bp_ui_components", title: "按钮用 <Button>，禁止 <button>", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_ui_comp_2", bestPracticeId: "bp_ui_components", title: "输入框用 <Input>，复选框用 <Checkbox>", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_ui_comp_3", bestPracticeId: "bp_ui_components", title: "下拉选择用 <Select> 组件族，禁止 <select>", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_ui_comp_4", bestPracticeId: "bp_ui_components", title: "文本域用 <Textarea>，标签用 <Label>", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_ui_comp_5", bestPracticeId: "bp_ui_components", title: "表格用 <Table> 组件族，分隔线用 <Separator>", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_ui_comp_6", bestPracticeId: "bp_ui_components", title: "对话框用 <Dialog>，禁止 <dialog> 或手动遮罩", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_use_store_not_props ─────────────────────────────────────────────────
  { id: "cl_store_props_1", bestPracticeId: "bp_use_store_not_props", title: "Store 中已有的数据不再通过 prop 传入子组件", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_store_props_2", bestPracticeId: "bp_use_store_not_props", title: "组件通过 useStore(selector) 直接读取 store 数据", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_store_props_3", bestPracticeId: "bp_use_store_not_props", title: "每次 hook 调用只取一个/紧密相关的字段", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_store_props_4", bestPracticeId: "bp_use_store_not_props", title: "保留的 props 仅限回调、路由 ID、纯展示标签", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_store_props_5", bestPracticeId: "bp_use_store_not_props", title: "props 类型已移除迁移到 store 的字段", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_zod_infer_type ──────────────────────────────────────────────────────
  { id: "cl_zod_1", bestPracticeId: "bp_zod_infer_type", title: "有 Zod schema 时类型必须用 z.infer<> 派生", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_zod_2", bestPracticeId: "bp_zod_infer_type", title: "派生类型与 schema 同文件导出", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_zod_3", bestPracticeId: "bp_zod_infer_type", title: "子集类型用 .omit()/.partial()/.pick() 生成", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_zod_4", bestPracticeId: "bp_zod_infer_type", title: "禁止创建 types.ts / type.ts / types/ 目录", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_zod_5", bestPracticeId: "bp_zod_infer_type", title: "schema 文件同时导出 const Schema + type 别名", description: "", checkType: "llm", sortOrder: 4 },
  { id: "cl_zod_6", bestPracticeId: "bp_zod_infer_type", title: "不存在手写 interface 与 Zod schema 字段重复", description: "", checkType: "llm", sortOrder: 5 },

  // ── bp_clean_hardcode ──────────────────────────────────────────────────────
  { id: "cl_clean_1", bestPracticeId: "bp_clean_hardcode", title: "无未使用的 import 语句", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_clean_2", bestPracticeId: "bp_clean_hardcode", title: "无 console.log/warn/error 调试输出", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_clean_3", bestPracticeId: "bp_clean_hardcode", title: "无注释掉的代码段", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_clean_4", bestPracticeId: "bp_clean_hardcode", title: "无空函数体", description: "", checkType: "llm", sortOrder: 3 },
  { id: "cl_clean_5", bestPracticeId: "bp_clean_hardcode", title: "无 debugger 语句", description: "", checkType: "llm", sortOrder: 4 },

  // ── bp_classname_convention ────────────────────────────────────────────────
  { id: "cl_cn_1", bestPracticeId: "bp_classname_convention", title: "动态 className 使用 cn() 函数", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_cn_2", bestPracticeId: "bp_classname_convention", title: "禁止模板字符串拼接 className", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_cn_3", bestPracticeId: "bp_classname_convention", title: "禁止字符串连接 className", description: "", checkType: "llm", sortOrder: 2 },
  { id: "cl_cn_4", bestPracticeId: "bp_classname_convention", title: "cn() 已从 @/lib/utils 导入", description: "", checkType: "llm", sortOrder: 3 },

  // ── bp_full_check_workflow ─────────────────────────────────────────────────
  { id: "cl_fullcheck_1", bestPracticeId: "bp_full_check_workflow", title: "扫描所有 *-best-practice/ 目录", description: "", checkType: "llm", sortOrder: 0 },
  { id: "cl_fullcheck_2", bestPracticeId: "bp_full_check_workflow", title: "对每个 best-practice 执行检查", description: "", checkType: "llm", sortOrder: 1 },
  { id: "cl_fullcheck_3", bestPracticeId: "bp_full_check_workflow", title: "输出汇总报告（通过/失败/违规项）", description: "", checkType: "llm", sortOrder: 2 },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding checklist items via REST API...\n");

  let upserted = 0;

  for (const item of CHECKLIST_ITEMS) {
    await apiPut("/api/checklist-items", item);
    upserted++;
  }

  console.log(`  ✅  ${upserted} checklist items upserted`);

  // Summary by best practice
  const bpCounts = new Map<string, number>();
  for (const item of CHECKLIST_ITEMS) {
    bpCounts.set(item.bestPracticeId, (bpCounts.get(item.bestPracticeId) ?? 0) + 1);
  }
  for (const [bp, count] of bpCounts) {
    console.log(`     ${bp}: ${count} items`);
  }

  console.log(`\n🎉 Done — ${upserted} checklist items across ${bpCounts.size} best practices.`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
