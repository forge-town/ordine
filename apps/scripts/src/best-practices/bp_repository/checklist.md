# Repository 层最佳实践 检查清单

- [ ] 1. Repository 只在跨表写入时创建
- [ ] 2. 多表写入必须包裹 db.transaction()
- [ ] 3. 事务内调用 DAO 的 WithTx 变体方法
- [ ] 4. 只返回 { id: string }，不返回完整业务对象
- [ ] 5. 不包含业务规则判断（属于 Service 层）
