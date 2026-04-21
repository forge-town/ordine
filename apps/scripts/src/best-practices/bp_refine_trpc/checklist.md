# Refine tRPC 数据获取最佳实践 检查清单

- [ ] 1. 组件中禁止直接调用 trpc.xxx.useQuery/useMutation
- [ ] 2. 读取数据使用 useList/useOne/useInfiniteList
- [ ] 3. 写入数据使用 useCreate/useUpdate/useDelete
- [ ] 4. 禁止直接 import @tanstack/react-query 获取数据
- [ ] 5. 扩展需求走 DataProvider，不绕过 Refine
