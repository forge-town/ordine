# 页面结构最佳实践 检查清单

- [ ] 1. 页面为独立目录，PascalCase 命名
- [ ] 2. 包含 Wrapper 文件（{PageName}.tsx）
- [ ] 3. 包含 Content 文件（{PageName}Content.tsx）
- [ ] 4. 有状态管理时 _store/ 目录包含 slice + store + provider
- [ ] 5. Wrapper 只负责组装和依赖注入，不含 UI 逻辑
