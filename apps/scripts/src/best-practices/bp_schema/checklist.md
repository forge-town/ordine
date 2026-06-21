# Schema 定义最佳实践 检查清单

- [ ] 1. 每个 Schema 一个独立文件，文件名 = Schema 名
- [ ] 2. TypeScript 类型必须用 z.infer<> 派生
  禁止手写 interface
- [ ] 3. 表结构 Schema: {TableName}Schema
- [ ] 4. 输入 Schema: {Action}{Feature}InputSchema
- [ ] 5. DAO 层不定义 Zod Schema，用 $inferSelect/$inferInsert
