# DAO 最佳实践 检查清单

- [ ] 1. 文件位于 models/daos/，命名 {feature}Dao.ts
- [ ] 2. 类型用 $inferSelect/$inferInsert 推导
  禁止手写
- [ ] 3. 写方法必须同时提供 WithTx 变体
- [ ] 4. 查询单条返回 T | null，多条返回 T[]
- [ ] 5. create/update 使用 .returning() 返回行
- [ ] 6. DAO 内禁止 try-catch、db.transaction()、调用其他 DAO
