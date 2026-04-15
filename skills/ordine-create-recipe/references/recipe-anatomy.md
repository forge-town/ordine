# Recipe 数据结构

## 核心字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，格式：`rcp_<动词>_<名词>` |
| `name` | `string` | 配方名称 |
| `description` | `string \| null` | 配方描述 |
| `operationId` | `string` | 关联的 Operation ID（外键） |
| `bestPracticeId` | `string` | 关联的 Best Practice ID（外键） |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## 核心概念

Recipe 回答一个关键问题：

> **用什么操作（Operation）来实施哪条规范（Best Practice）？**

例如：
- `rcp_check_classname` = `op_check_classname` + `bp_classname_convention`
  → "用 className 检查操作来实施 className 使用 cn() 的规范"
- `rcp_check_barrel` = `op_check_barrel_export` + `bp_barrel_export`
  → "用桶导出检查操作来实施桶导出规范"

## 三者关系

```
Best Practice（规范）     Operation（操作）
  bp_classname_convention   op_check_classname
          \                     /
           \                   /
            → Recipe（绑定） ←
          rcp_check_classname
```

- **Best Practice** 定义了规范的内容、条件、代码示例和检查清单
- **Operation** 定义了执行器、输入输出
- **Recipe** 将两者绑定，表示"用这个操作来检查/修复这条规范"

## 完整示例

```json
{
  "id": "rcp_check_all_practices",
  "name": "检查所有最佳实践",
  "description": "使用全量检查操作来验证所有编码规范",
  "operationId": "op_check_all",
  "bestPracticeId": "bp_all_practices"
}
```

## 一对多绑定

一个 Operation 可以被多个 Recipe 引用（一个操作可以检查多条规范）：

```
op_check_naming → rcp_check_file_naming   + bp_file_naming
                → rcp_check_var_naming     + bp_variable_naming
                → rcp_check_func_naming    + bp_function_naming
```

一个 Best Practice 也可以对应多个 Recipe（一条规范可以用不同操作检查）：

```
bp_classname_convention → rcp_check_classname + op_check_classname
                        → rcp_fix_classname   + op_fix_classname
```

## 命名规范

| 前缀 | 用途 | 示例 |
|---|---|---|
| `rcp_check_` | 检查型配方 | `rcp_check_classname`, `rcp_check_barrel` |
| `rcp_fix_` | 修复型配方 | `rcp_fix_classname`, `rcp_fix_import` |
| `rcp_gen_` | 生成型配方 | `rcp_gen_test_from_bp` |
