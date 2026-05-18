---
name: Analyze Dependencies
description: 分析项目依赖关系，生成依赖图和升级建议报告
input: github-project
---

# Analyze Dependencies

对 GitHub 项目的依赖进行全面分析：

1. 解析 `package.json`（含 monorepo 下所有 workspace 的 package.json）
2. 识别以下问题：
   - 过时的依赖（有新的 major / minor / patch 版本）
   - 重复依赖（不同 workspace 使用不同版本）
   - 未使用的依赖（声明了但代码中未 import）
   - 缺少的 peer dependencies
3. 生成包之间的内部依赖关系图
4. 对每个有问题的依赖给出具体升级建议

## Outputs

- **report.md**: 分析报告，按严重程度排序，包含升级建议和潜在 breaking changes 说明
- **dependency-graph.svg**: 包之间的依赖关系可视化图（使用 Mermaid 语法描述，渲染为 SVG）
- **outdated.json**: 过时依赖的结构化数据 `{ package, current, latest, type }[]`
