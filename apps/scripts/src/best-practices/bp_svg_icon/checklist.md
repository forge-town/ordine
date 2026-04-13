# SVG 图标最佳实践 检查清单

- [ ] 1. 所有 SVG 封装为独立 .tsx 存放于 icons/
- [ ] 2. 文件名 PascalCase 以 Icon 结尾
- [ ] 3. 使用 SVGProps<SVGSVGElement>，属性可覆盖
- [ ] 4. 具名导出，禁止 default export
- [ ] 5. icons/index.ts 统一桶导出所有图标
- [ ] 6. 业务组件内不存在内联 <svg> 标签
