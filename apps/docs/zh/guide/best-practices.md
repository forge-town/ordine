# 最佳实践

最佳实践是 Ordine 的基础构建块。它们将编码规范编码为带有可验证检查清单的结构化数据。

## 结构

```json
{
  "name": "React 组件规范",
  "description": "React 组件的编码规范",
  "checklistItems": [
    { "title": "使用函数组件", "description": "优先使用函数组件而非类组件" },
    { "title": "Props 类型定义", "description": "所有 props 都应有 TypeScript 类型定义" }
  ]
}
```

## 创建最佳实践

### 通过 UI

1. 打开 Web 应用，导航到 **最佳实践**
2. 点击 **创建**
3. 填写名称和描述
4. 添加检查清单项

### 通过 API

```sh
curl -X POST http://localhost:9433/api/best-practices \
  -H "Content-Type: application/json" \
  -d '{"name": "示例实践", "description": "示例描述"}'
```

## 在操作中使用

最佳实践通过 ID 在操作配置中引用。agent 执行器在运行时会接收最佳实践的上下文，包括检查清单项和描述信息。
