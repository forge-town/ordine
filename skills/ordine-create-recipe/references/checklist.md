# Recipe 创建检查清单

## 基础字段

- [ ] `id` 遵循命名规范：`rcp_<check|fix|gen>_<noun>`
- [ ] `name` 清晰描述此绑定的目的

## 关联有效性

- [ ] `operationId` 指向一个已存在的 Operation
- [ ] `bestPracticeId` 指向一个已存在的 Best Practice
- [ ] Operation 和 Best Practice 在语义上匹配（检查操作对应检查规范）

## 避免重复

- [ ] 不存在相同 operationId + bestPracticeId 的 Recipe
- [ ] ID 不与已有 Recipe 冲突

## 配对完整性

- [ ] 如果创建了 check Recipe，考虑是否需要对应的 fix Recipe
- [ ] 如果 Operation 是 fix 类型，是否有对应的 check Recipe 存在
