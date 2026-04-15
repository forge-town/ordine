# Operation 创建检查清单

## 必填项

- [ ] `id` 遵循命名规范：`op_<check|fix|gen|analyze>_<noun>`
- [ ] `name` 清晰描述操作目的
- [ ] `config` 是合法 JSON 字符串

## executor 配置

- [ ] `executor.type` 为 `"skill"` 或 `"script"`
- [ ] 当 type=skill 时，`executor.skillId` 指向一个已存在的 Skill
- [ ] 当 type=script 时，`executor.scriptPath` 路径正确

## 输入输出

- [ ] `inputs` 至少定义一个输入
- [ ] 每个 input 的 `kind` 与实际数据类型匹配
- [ ] `outputs` 至少定义一个输出
- [ ] 输出 `path` 路径合理，不会覆盖重要文件

## 对象类型

- [ ] `acceptedObjectTypes` 声明了所有支持的对象类型
- [ ] 声明的类型与 inputs 的 kind 一致

## 关联性

- [ ] 如果是 fix 操作，是否有对应的 check 操作
- [ ] 是否需要创建对应的 Recipe 绑定 Best Practice
