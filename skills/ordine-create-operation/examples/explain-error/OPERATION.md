---
name: Explain Error
description: 解释错误信息并提供修复方案
input: prompt
---

# Explain Error

用户会提供一段错误信息（stack trace、编译错误、运行时异常等），你需要：

1. 用简明的语言解释错误的根本原因
2. 列出最可能的触发场景
3. 提供具体的修复步骤（优先级排序）
4. 如果是常见错误，说明如何预防

保持解释简洁直接，避免泛泛而谈。优先给出可操作的修复方案。

## Outputs

- **explanation.md**: 错误解释和修复方案文档
