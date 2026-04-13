# Zod 类型派生最佳实践 检查清单

- [ ] 1. 有 Zod schema 时类型必须用 z.infer<> 派生
- [ ] 2. 派生类型与 schema 同文件导出
- [ ] 3. 子集类型用 .omit()/.partial()/.pick() 生成
- [ ] 4. 禁止创建 types.ts / type.ts / types/ 目录
- [ ] 5. schema 文件同时导出 const Schema + type 别名
- [ ] 6. 不存在手写 interface 与 Zod schema 字段重复
