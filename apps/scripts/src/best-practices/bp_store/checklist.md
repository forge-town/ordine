# Zustand Store 最佳实践 检查清单

- [ ] 1. Store 位于页面 _store/ 目录
- [ ] 2. Slice 文件 {name}Slice.ts，Store 文件 {name}Store.ts
- [ ] 3. 不包含 loading/error 等异步状态字段
- [ ] 4. Slice 只含同步状态修改，无副作用
  禁止 fetch/toast/DOM
- [ ] 5. 方法命名 handle{Action}，不用 set{Field}
- [ ] 6. Provider 在 Wrapper 组件中使用
