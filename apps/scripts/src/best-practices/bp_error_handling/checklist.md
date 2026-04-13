# 错误处理最佳实践 检查清单

- [ ] 1. 必须使用 neverthrow，禁止原生 try-catch
- [ ] 2. 可能失败的函数返回 Result<T, E> 或 ResultAsync
- [ ] 3. 调用方必须处理错误（match/map/mapErr）
- [ ] 4. 定义具体错误类，禁止 err("string")
- [ ] 5. 使用 andThen 组合多个可能失败的操作
- [ ] 6. 不存在忽略 Result 或返回裸值的函数
