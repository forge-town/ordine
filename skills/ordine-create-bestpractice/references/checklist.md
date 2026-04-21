# Best Practice 创建检查清单

## 基础字段

- [ ] `id` 遵循命名规范：`bp_<noun>_<detail>`
- [ ] `title` 简洁明了，一眼知其意
- [ ] `condition` 具体描述触发场景（非泛泛描述）
- [ ] `content` 包含可操作的具体指导

## 代码示例

- [ ] `codeSnippet` 包含 Good/Bad 对比
- [ ] 代码片段语法正确，可直接使用
- [ ] `language` 字段与代码语言匹配

## 分类与标签

- [ ] `category` 选择了正确的枚举值
- [ ] `tags` 包含相关关键词（便于搜索）

## Checklist Items

- [ ] 至少有 2 个 checklist items
- [ ] 每个 item 的 `content` 可判定（yes/no）
- [ ] `sortOrder` 从 0 开始连续递增
- [ ] 覆盖了规范的主要检查点

## Code Snippets（可选但推荐）

- [ ] 至少一个 Good 示例 + 一个 Bad 示例
- [ ] 每个 snippet 有 `title` 标识正确/错误
- [ ] 代码完整可运行

## 关联性

- [ ] 是否有对应的 Operation 可以自动检查此规范
- [ ] 如果有，是否已创建 Recipe 绑定
