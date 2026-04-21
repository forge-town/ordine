# Best Practice 数据结构

## 核心字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，格式：`bp_<名词>_<描述>` |
| `title` | `string` | 规范标题 |
| `condition` | `string \| null` | 触发条件 — 什么情况下应用此规范 |
| `content` | `string \| null` | 规范正文 — 详细描述怎么做 |
| `codeSnippet` | `string \| null` | 内联代码片段（简单示例） |
| `category` | `string \| null` | 分类：`naming`, `structure`, `testing`, `style`, `performance`, `security` |
| `language` | `string \| null` | 适用语言：`typescript`, `javascript`, `react`, `css`, `sql` |
| `tags` | `string[] \| null` | 标签数组 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## 关联实体

### Checklist Items（检查清单条目）

每个 Best Practice 可以有多个 checklist items，用于逐条验证是否符合规范：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `bestPracticeId` | `string` | 所属 Best Practice ID |
| `content` | `string` | 检查项描述 |
| `sortOrder` | `number` | 排序序号 |

### Code Snippets（代码片段）

每个 Best Practice 可以有多个详细代码片段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识 |
| `bestPracticeId` | `string` | 所属 Best Practice ID |
| `title` | `string \| null` | 片段标题 |
| `code` | `string` | 代码内容 |
| `language` | `string \| null` | 代码语言 |
| `sortOrder` | `number` | 排序序号 |

## 完整示例

```json
{
  "id": "bp_classname_convention",
  "title": "className 使用 cn() 函数",
  "condition": "当组件中使用 className 动态拼接时",
  "content": "所有动态 className 必须使用 cn() 工具函数（基于 clsx + tailwind-merge），禁止使用模板字符串拼接。cn() 可以自动处理 Tailwind 类名冲突。",
  "codeSnippet": "import { cn } from '@/lib/utils'\n\n// ✅ Good\n<div className={cn('p-4', isActive && 'bg-blue-500')} />\n\n// ❌ Bad\n<div className={`p-4 ${isActive ? 'bg-blue-500' : ''}`} />",
  "category": "style",
  "language": "react",
  "tags": ["className", "tailwind", "cn"]
}
```

带 Checklist Items：

```json
[
  { "id": "cli_cn_1", "bestPracticeId": "bp_classname_convention", "content": "所有动态 className 使用 cn() 函数", "sortOrder": 0 },
  { "id": "cli_cn_2", "bestPracticeId": "bp_classname_convention", "content": "没有模板字符串拼接 className", "sortOrder": 1 },
  { "id": "cli_cn_3", "bestPracticeId": "bp_classname_convention", "content": "cn() 从 @/lib/utils 导入", "sortOrder": 2 }
]
```

带 Code Snippets：

```json
[
  {
    "id": "cs_cn_good",
    "bestPracticeId": "bp_classname_convention",
    "title": "✅ 正确用法",
    "code": "import { cn } from '@/lib/utils'\n\nexport function Button({ variant, className }) {\n  return (\n    <button className={cn(\n      'px-4 py-2 rounded',\n      variant === 'primary' && 'bg-blue-500 text-white',\n      variant === 'secondary' && 'bg-gray-200',\n      className\n    )} />\n  )\n}",
    "language": "tsx",
    "sortOrder": 0
  },
  {
    "id": "cs_cn_bad",
    "bestPracticeId": "bp_classname_convention",
    "title": "❌ 错误用法",
    "code": "// 模板字符串 — 无法处理 Tailwind 类名冲突\n<button className={`px-4 py-2 ${variant === 'primary' ? 'bg-blue-500' : 'bg-gray-200'} ${className}`} />",
    "language": "tsx",
    "sortOrder": 1
  }
]
```

## category 枚举

| 值 | 含义 | 示例 |
|---|---|---|
| `naming` | 命名规范 | 文件命名、变量命名、函数命名 |
| `structure` | 结构规范 | 文件夹结构、模块划分、层次架构 |
| `testing` | 测试规范 | 测试命名、测试覆盖率、测试组织 |
| `style` | 代码风格 | className、导入排序、格式化 |
| `performance` | 性能优化 | 懒加载、缓存、查询优化 |
| `security` | 安全规范 | 输入验证、错误处理、权限检查 |
