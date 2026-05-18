---
name: Check DAO Pattern
description: 检查 DAO 层代码是否符合项目约定的模式和最佳实践
input: folder
---

# Check DAO Pattern

对目标代码中的 DAO（Data Access Object）层进行全面检查，确保符合以下约定：

1. 每个 DAO 文件导出一个 `create*Dao` 工厂函数，接收 `db` 参数
2. DAO 方法只做数据存取，不包含业务逻辑（不做验证、不抛业务异常）
3. 方法命名遵循 `create` / `findById` / `findMany` / `update` / `delete` 模式
4. 所有写操作（create / update）必须返回更新后的完整记录
5. 不直接返回 Drizzle query builder，必须 `.then()` 或 `await` 后返回 plain object
6. 删除操作不需要返回值

## Outputs

- **report.md**: 检查报告，每个问题包含：
  - 文件路径和行号
  - 问题描述和严重程度（error / warning）
  - 修复建议和正确写法示例
- **stats.json**: 统计摘要 `{ totalFiles, totalIssues, errors, warnings, passedFiles }`
