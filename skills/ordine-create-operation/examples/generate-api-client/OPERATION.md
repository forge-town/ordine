---
name: Generate API Client
description: 根据 OpenAPI 规范生成类型安全的 TypeScript API 客户端代码
input: file
---

# Generate API Client

读取提供的 OpenAPI 3.x 规范文件（JSON 或 YAML），为每个 endpoint 生成类型安全的 TypeScript 客户端代码。

要求：

1. 为每个 schema 生成对应的 TypeScript interface
2. 为每个 endpoint 生成调用函数，包含完整的请求/响应类型
3. 函数签名使用具名参数对象（不是位置参数）
4. 使用 `fetch` 作为 HTTP 客户端，不引入额外依赖
5. 错误处理使用 `Result` 类型（neverthrow 风格），不使用 try-catch
6. 支持 path parameters、query parameters、request body
7. 生成的代码必须通过 TypeScript strict mode 检查

## Outputs

- **client.ts**: API 客户端代码，包含所有 endpoint 的调用函数
- **types.ts**: 从 OpenAPI schemas 生成的 TypeScript 类型定义
