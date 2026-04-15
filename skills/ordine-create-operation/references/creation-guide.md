# 创建 Operation 指南

## 通过 CLI

> CLI 当前不直接支持 Operation CRUD。使用 REST API 或通过 CLI 管理 Pipeline 来间接操作。

## 通过 REST API 创建

### 1. 创建 Operation

```bash
curl -X POST http://localhost:9431/api/operations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "op_check_naming",
    "name": "检查命名规范",
    "description": "检查文件和变量命名是否符合项目规范",
    "config": "{\"executor\":{\"type\":\"skill\",\"skillId\":\"skill_check_naming\"},\"inputs\":[{\"name\":\"target_folder\",\"kind\":\"folder\",\"required\":true}],\"outputs\":[{\"name\":\"report\",\"kind\":\"file\",\"path\":\"reports/naming-report.md\"}]}",
    "acceptedObjectTypes": ["folder", "code-file"]
  }'
```

### 2. 查看已有 Operation

```bash
# 列出所有
curl -s http://localhost:9431/api/operations | python3 -m json.tool

# 查看单个
curl -s http://localhost:9431/api/operations/op_check_naming | python3 -m json.tool
```

### 3. 更新 Operation（PUT = upsert）

```bash
curl -X PUT http://localhost:9431/api/operations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "op_check_naming",
    "name": "检查命名规范（v2）",
    "description": "升级版命名检查",
    "config": "{\"executor\":{\"type\":\"skill\",\"skillId\":\"skill_check_naming_v2\"},\"inputs\":[{\"name\":\"target_folder\",\"kind\":\"folder\",\"required\":true}],\"outputs\":[{\"name\":\"report\",\"kind\":\"file\",\"path\":\"reports/naming-report-v2.md\"}]}",
    "acceptedObjectTypes": ["folder", "code-file"]
  }'
```

### 4. 删除 Operation

```bash
curl -X DELETE http://localhost:9431/api/operations/op_check_naming
```

## 创建步骤

### Step 1: 确定 Operation 类型

- **Check**（检查型）：只读分析，输出报告
- **Fix**（修复型）：读写操作，修改代码

### Step 2: 确定执行器

选择执行方式：
- **Skill 执行**：指定一个已有的 Skill ID，由 AI Agent 通过该 Skill 执行
- **Script 执行**：指定一个脚本路径，直接运行

### Step 3: 定义输入

思考这个操作需要什么输入数据：
- 需要扫描哪种类型的资源？（folder / code-file / github-project）
- 输入是否必填？

### Step 4: 定义输出

思考这个操作产出什么：
- 输出是报告文件？JSON 数据？还是 diff 补丁？
- 输出保存到哪里？

### Step 5: 声明 acceptedObjectTypes

声明此 Operation 可以处理哪些对象类型，供 Pipeline 校验使用。

## 常见模板

### 检查型 Operation 模板

```json
{
  "id": "op_check_<what>",
  "name": "检查<什么>规范",
  "description": "检查代码是否符合<什么>最佳实践",
  "config": "{\"executor\":{\"type\":\"skill\",\"skillId\":\"skill_check_<what>\"},\"inputs\":[{\"name\":\"target_folder\",\"kind\":\"folder\",\"required\":true}],\"outputs\":[{\"name\":\"report\",\"kind\":\"file\",\"path\":\"reports/<what>-check-report.md\"}]}",
  "acceptedObjectTypes": ["folder", "code-file"]
}
```

### 修复型 Operation 模板

```json
{
  "id": "op_fix_<what>",
  "name": "修复<什么>问题",
  "description": "自动修复不符合<什么>规范的代码",
  "config": "{\"executor\":{\"type\":\"skill\",\"skillId\":\"skill_fix_<what>\"},\"inputs\":[{\"name\":\"target_folder\",\"kind\":\"folder\",\"required\":true},{\"name\":\"check_report\",\"kind\":\"file\",\"required\":true}],\"outputs\":[{\"name\":\"diff\",\"kind\":\"diff\",\"path\":\"reports/<what>-fix.diff\"},{\"name\":\"summary\",\"kind\":\"file\",\"path\":\"reports/<what>-fix-summary.md\"}]}",
  "acceptedObjectTypes": ["folder", "code-file"]
}
```

### Check-Fix 配对

通常一对 Check + Fix 操作配合使用：

```
op_check_classname  →  输出报告  →  op_fix_classname 读取报告并修复
```

这种配对在 Pipeline 中表现为：输入节点 → check 节点 → fix 节点 → 输出节点。

## 命名规范

| 前缀 | 用途 | 示例 |
|---|---|---|
| `op_check_` | 检查型操作 | `op_check_dao`, `op_check_barrel_export` |
| `op_fix_` | 修复型操作 | `op_fix_classname`, `op_fix_import` |
| `op_gen_` | 生成型操作 | `op_gen_test`, `op_gen_storybook` |
| `op_analyze_` | 分析型操作 | `op_analyze_complexity`, `op_analyze_deps` |
