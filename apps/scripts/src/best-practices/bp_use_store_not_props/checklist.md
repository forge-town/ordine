# Store 优先于 Props 最佳实践 检查清单

- [ ] 1. Store 中已有的数据不再通过 prop 传入子组件
- [ ] 2. 组件通过 useStore(selector) 直接读取 store 数据
- [ ] 3. 每次 hook 调用只取一个/紧密相关的字段
- [ ] 4. 保留的 props 仅限回调、路由 ID、纯展示标签
- [ ] 5. props 类型已移除迁移到 store 的字段
