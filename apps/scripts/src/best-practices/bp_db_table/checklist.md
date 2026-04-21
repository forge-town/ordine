# 数据库表定义最佳实践 检查清单

- [ ] 1. SQL 表名全小写 + 下划线分隔 + 英文复数
- [ ] 2. 文件名格式 {sql_tablename}_table.ts
- [ ] 3. TS 变量名 {sqlTableName}Table（camelCase + Table 后缀）
- [ ] 4. SQL 列名 snake_case，TS 键名 camelCase
- [ ] 5. 无无意义后缀（_data、_info、_tbl）
- [ ] 6. pgTable 第一参数与文件名去 _table.ts 部分一致
