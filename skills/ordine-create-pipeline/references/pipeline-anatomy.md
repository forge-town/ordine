# Pipeline 解剖

## 数据结构

```json
{
  "id": "pipe_xxx",
  "name": "描述性名称",
  "description": "这条 pipeline 做什么",
  "tags": ["check", "quality"],
  "nodes": [...],
  "edges": [...]
}
```

## 节点 (nodes)

每个节点代表 DAG 中的一个步骤。

### 通用字段

```json
{
  "id": "n_xxx",
  "type": "folder | operation | output-local-path | code-file | github-project | condition",
  "data": {
    "label": "节点名称",
    "nodeType": "同 type",
    "description": "节点描述"
  },
  "position": { "x": 0, "y": 0 }
}
```

### 节点类型

| type | 用途 | data 特有字段 |
|------|------|-------------|
| `folder` | 输入源 - 本地文件夹 | `folderPath` |
| `code-file` | 输入源 - 代码文件 | `filePath` |
| `github-project` | 输入源 - GitHub 项目 | `repo`, `branch` |
| `operation` | 执行动作（检查/修复） | `operationId`, `operationName`, `status` |
| `output-local-path` | 输出目标 - 本地路径 | `localPath`, `outputMode`, `dualOutput` |
| `condition` | 条件分支 | `condition` |

## 边 (edges)

边定义节点之间的数据流向。

```json
{
  "id": "e_xxx",
  "source": "n_input",
  "target": "n_check"
}
```

## 典型 Pipeline 模式

### 1. 线性检查 (input → check → output)

```
[文件夹] → [检查 Operation] → [报告输出]
```

### 2. 检查修复 (input → check → fix → output)

```
[文件夹] → [检查 Operation] → [修复 Operation] → [报告输出]
```

### 3. 并发检查 (input → [check1, check2, check3] → [out1, out2, out3])

```
                  ┌→ [检查 DAO] → [DAO 报告]
[文件夹] ─→ ├→ [检查 Schema] → [Schema 报告]
                  └→ [检查 Store] → [Store 报告]
```

## ID 命名规范

- Pipeline ID: `pipe_` 前缀，如 `pipe_check_fix_svg_icon`
- Node ID: `n_` 前缀，如 `n_input`, `n_check_dao`, `n_output_dao`
- Edge ID: `e_` 前缀，如 `e_in_dao`, `e_dao_out`
