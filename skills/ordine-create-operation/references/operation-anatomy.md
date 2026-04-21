# Operation 数据结构

## 核心字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 唯一标识，格式：`op_<动词>_<名词>` |
| `name` | `string` | 人类可读名称 |
| `description` | `string \| null` | 操作描述 |
| `config` | `string (JSON)` | 执行器配置（JSON 字符串） |
| `acceptedObjectTypes` | `string[] \| null` | 接受的对象类型，如 `["folder", "code-file", "github-project"]` |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |

## config JSON 结构

`config` 字段是一个 JSON 字符串，解析后结构如下：

```json
{
  "executor": {
    "type": "agent",
    "agentMode": "skill",
    "skillId": "skill_check_dao"
  },
  "inputs": [
    {
      "name": "target_folder",
      "kind": "folder",
      "required": true
    }
  ],
  "outputs": [
    {
      "name": "report",
      "kind": "file",
      "path": "reports/dao-check-report.md"
    }
  ]
}
```

### executor（执行器）

执行器决定了 Operation 由谁来执行：

| 字段 | 说明 |
|---|---|
| `executor.type` | 执行器类型：`"skill"`（调用 Skill）或 `"script"`（运行脚本） |
| `executor.skillId` | 当 type=skill 时，指向的 Skill ID |
| `executor.scriptPath` | 当 type=script 时，脚本路径 |

### inputs（输入）

定义 Operation 需要接收什么数据：

| 字段 | 说明 |
|---|---|
| `name` | 输入名称，Pipeline 中用于映射数据流 |
| `kind` | 输入类型：`"folder"`, `"code-file"`, `"github-project"`, `"text"`, `"json"` |
| `required` | 是否必填 |

### outputs（输出）

定义 Operation 产出什么：

| 字段 | 说明 |
|---|---|
| `name` | 输出名称，Pipeline 中下游节点可引用 |
| `kind` | 输出类型：`"file"`, `"json"`, `"report"`, `"diff"` |
| `path` | 输出文件路径（可选） |

## acceptedObjectTypes

Operation 声明自己可以处理哪些类型的对象：

- `folder` — 文件夹
- `code-file` — 代码文件
- `github-project` — GitHub 项目
- `text` — 纯文本
- `json` — JSON 数据

## Operation 的两种类型

### Check（检查型）
检查代码是否符合规范，输出报告：
- 命名规则：`op_check_<what>`
- 例如：`op_check_dao`, `op_check_classname`, `op_check_barrel_export`

### Fix（修复型）
自动修复不符合规范的代码：
- 命名规则：`op_fix_<what>`
- 例如：`op_fix_classname`, `op_fix_barrel_export`

## 完整示例

```json
{
  "id": "op_check_dao",
  "name": "检查 DAO 规范",
  "description": "检查 DAO 文件是否遵循 Drizzle ORM 最佳实践",
  "config": "{\"executor\":{\"type\":\"skill\",\"skillId\":\"skill_check_dao\"},\"inputs\":[{\"name\":\"target_folder\",\"kind\":\"folder\",\"required\":true}],\"outputs\":[{\"name\":\"report\",\"kind\":\"file\",\"path\":\"reports/dao-check-report.md\"}]}",
  "acceptedObjectTypes": ["folder", "code-file"]
}
```
