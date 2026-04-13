# 国际化最佳实践 检查清单

- [ ] 1. 使用 LanguageDetector + initReactI18next 初始化
- [ ] 2. fallbackLng 已配置，escapeValue 为 false
- [ ] 3. 翻译文件位于 src/locales/，key 按模块分组 camelCase
- [ ] 4. 组件中用 useTranslation() 获取 t 函数
- [ ] 5. 富文本用 <Trans> 组件，禁止 dangerouslySetInnerHTML
- [ ] 6. 所有语言文件 key 结构完全一致（镜像关系）
