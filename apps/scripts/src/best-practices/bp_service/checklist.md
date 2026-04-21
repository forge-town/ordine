# Service 层最佳实践 检查清单

- [ ] 1. 文件位于 services/，命名 {feature}Service.ts
- [ ] 2. 严禁直接 import db 做普通查询，通过 DAO 操作
- [ ] 3. 方法返回类型明确声明 Promise<T>
- [ ] 4. 业务规则在 Service 层处理，不下沉到 DAO
- [ ] 5. 不使用 any 类型
