# 表单最佳实践 检查清单

- [ ] 1. 表单状态由 react-hook-form 管理，禁止 useState
- [ ] 2. 使用 zodResolver 集成 Zod 校验
- [ ] 3. 字段通过 render={({ field }) => ...} 接入
- [ ] 4. defaultValues 使用深拷贝副本
  禁止传引用
- [ ] 5. 跨子组件用 FormProvider + useFormContext
  禁止传 control
- [ ] 6. 表单是独立沙盒，仅在 onSubmit 时对外输出
