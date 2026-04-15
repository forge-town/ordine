# 节点类型详解

## folder — 文件夹输入

代表一个本地文件系统目录作为输入源。

```json
{
  "id": "n_input",
  "type": "folder",
  "data": {
    "label": "源代码目录",
    "nodeType": "folder",
    "folderPath": "/Users/amin/projects/my-project/src",
    "description": "要检查的源代码目录"
  },
  "position": { "x": 0, "y": 0 }
}
```

**注意**: `folderPath` 留空表示运行时由用户指定。

## operation — 操作节点

执行一个预定义的 Operation（检查或修复动作）。

```json
{
  "id": "n_check_dao",
  "type": "operation",
  "data": {
    "label": "检查 DAO 层规范",
    "nodeType": "operation",
    "operationId": "op_check_dao",
    "operationName": "检查 DAO 层规范",
    "status": "idle"
  },
  "position": { "x": 500, "y": 0 }
}
```

**`operationId`** 必须引用已存在的 Operation。status 值：`idle | running | success | failed`。

## output-local-path — 本地路径输出

将 Operation 的结果写入本地文件系统。

```json
{
  "id": "n_output_report",
  "type": "output-local-path",
  "data": {
    "label": "检查报告",
    "nodeType": "output-local-path",
    "localPath": "/Users/amin/projects/my-project/.ordine/results/check-report",
    "outputMode": "overwrite",
    "dualOutput": true,
    "description": "DAO 层规范检查报告"
  },
  "position": { "x": 1000, "y": 0 }
}
```

**字段说明**:
- `outputMode`: `"overwrite"` 覆盖 | `"append"` 追加
- `dualOutput`: `true` 时同时输出 markdown 和 JSON

## code-file — 代码文件输入

```json
{
  "id": "n_file",
  "type": "code-file",
  "data": {
    "label": "目标文件",
    "nodeType": "code-file",
    "filePath": "/path/to/file.ts"
  },
  "position": { "x": 0, "y": 0 }
}
```

## github-project — GitHub 项目输入

```json
{
  "id": "n_github",
  "type": "github-project",
  "data": {
    "label": "GitHub 项目",
    "nodeType": "github-project",
    "repo": "owner/repo",
    "branch": "main"
  },
  "position": { "x": 0, "y": 0 }
}
```

## condition — 条件分支

```json
{
  "id": "n_condition",
  "type": "condition",
  "data": {
    "label": "是否有违规",
    "nodeType": "condition",
    "condition": "violations > 0"
  },
  "position": { "x": 500, "y": 200 }
}
```
