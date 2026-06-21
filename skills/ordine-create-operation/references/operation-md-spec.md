# OPERATION.md 格式规范

## 总览

每个 Operation 是一个文件夹，核心文件为 `OPERATION.md`。文件系统即 source of truth，DB 做索引/缓存。

```
operations/
  check-dao-pattern/
    OPERATION.md          # 必须
    references/           # 可选，放详细参考文档
      examples.md
      checklist.md
```

**文件夹名即 Operation ID**，格式：`<动词>-<名词>`（kebab-case）。

---

## OPERATION.md 结构

```markdown
---
name: Check DAO Pattern
description: 检查 DAO 层代码是否符合项目约定的模式和最佳实践
acceptedObjectTypes: [file, folder]
---

# Check DAO Pattern

(Markdown body = 给执行器的指令，描述这个 operation 应该做什么、产出什么)
```

### Frontmatter 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | **是** | 人类可读名称 |
| `description` | `string` | **是** | 一句话描述 |
| `input` | `string` | 否 | 接受的对象类型，默认 `any`。可选值：`file`, `folder`, `github-project`, `prompt`, `any` |

- `any` 表示 operation 什么输入都接受，自己判断如何处理

Frontmatter **只放元数据**。不放 executor 配置 — 由 runner 运行时决定。

### Markdown Body

Body 是给执行器（agent）的**自然语言指令**，描述 operation 应该做什么。它取代了 JSON config 里的结构化定义。

Body **必须**包含 `## Outputs` section 来声明产出文件。其余部分是自由格式的指令。

#### `## Outputs`（必填）

严格声明 operation 的产出文件。**每个输出必须明确文件扩展名**，扩展名即类型：

```markdown
## Outputs

- **report.md**: 检查报告，包含所有发现的问题和建议
- **stats.json**: 统计数据，包含 totalFiles, totalIssues 等字段
- **diagram.svg**: 架构依赖关系图
```

格式：`- **<filename>.<ext>**: <description>`

扩展名决定了文件的类型和格式约束：

| 扩展名 | 语义 |
|---|---|
| `.md` | Markdown 文档 |
| `.json` | JSON 结构化数据 |
| `.txt` | 纯文本 |
| `.svg` | SVG 矢量图 |
| `.html` | HTML 页面 |
| `.csv` | CSV 表格数据 |
| `.yaml` | YAML 配置/数据 |

#### 其他 Section

Body 的其余部分是自由格式的指令。可以包含：

- 具体的检查规则或要求
- 输出格式示例
- 边界条件说明
- 引用 `references/` 下的详细文档

---

## 最小示例

```markdown
---
name: Check Naming Convention
description: 检查代码命名是否符合项目规范
---

# Check Naming Convention

检查目标代码中的变量、函数、类名是否符合 camelCase/PascalCase 命名规范。

## Outputs

- **report.md**: 命名不规范的清单，每项包含文件路径、行号和建议修改
```

## 完整示例

```markdown
---
name: Check DAO Pattern
description: 检查 DAO 层代码是否符合项目约定的模式和最佳实践
input: folder
---

# Check DAO Pattern

对目标代码中的 DAO（Data Access Object）层进行全面检查，确保符合以下约定：

1. 每个 DAO 方法必须返回 plain object，不返回 Drizzle query builder
2. DAO 不包含业务逻辑，只做数据存取
3. 命名格式：`create`, `findById`, `findMany`, `update`, `delete`
4. 所有写操作必须返回更新后的记录

## Outputs

- **report.md**: 检查报告，包含文件路径、问题描述、严重程度（error/warning）和修复建议
- **stats.json**: 统计数据 `{ totalFiles, totalIssues, errors, warnings }`

## 参考

参见 [DAO 最佳实践](references/dao-best-practices.md) 获取完整的规则清单。
```

---

## 设计原则

1. **Body 即 Prompt** — Markdown body 就是给 agent 的指令，自然语言优先
2. **最小 Frontmatter** — 只放 scanner 需要的元数据（name, description, input），不放 executor 细节
3. **Outputs 严格声明** — `## Outputs` 必须明确文件名和扩展名，扩展名即类型，无歧义
4. **文件夹名即 ID** — 不需要在 frontmatter 里重复声明 id
5. **Input 语义简单** — 一个 `input` 字段声明接受的对象类型，`any` 表示全接受
6. **渐进式丰富** — 最简形式只需 frontmatter + 一段描述 + Outputs，复杂场景再加 references

---

## 与现有 JSON Config 的映射关系

| OPERATION.md | 现有 JSON Config | 说明 |
|---|---|---|
| frontmatter `name` | `operation.name` | 直接映射 |
| frontmatter `description` | `operation.description` | 直接映射 |
| frontmatter `input` | `operation.acceptedObjectTypes` | `any` → 全部类型，其他 → 单类型数组 |
| `## Outputs` section | `config.outputs[]` | 文件名+扩展名 → `{ name, kind }` |
| 整个 body | `config.executor.systemPrompt` | Body 即 agent 的 system prompt |
| (不在 OPERATION.md 中) | `config.executor.type/agent` | 运行时由 runner 决定 |
| (不在 OPERATION.md 中) | `config.inputs[]` | 由 `input` 字段 + 运行时上下文推断 |
