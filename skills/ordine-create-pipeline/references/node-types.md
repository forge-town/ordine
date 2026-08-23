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

执行一个预定义的业务 Operation，例如生成、转换、检查、修复或导出。

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
    "description": "DAO 层规范检查报告"
  },
  "position": { "x": 1000, "y": 0 }
}
```

**字段说明**:

- `outputMode`: `"overwrite"` 覆盖 | `"append"` 追加

## file — 代码文件输入

```json
{
  "id": "n_file",
  "type": "file",
  "data": {
    "label": "目标文件",
    "nodeType": "file",
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
    "owner": "owner",
    "repo": "repo",
    "branch": "main"
  },
  "position": { "x": 0, "y": 0 }
}
```

**注意**: `owner` 和 `repo` 均为必填字段。若用户输入 `owner/repo`，必须拆分成两个字段，不能把完整值只放进 `repo`。

## prompt — 文本或指令输入

```json
{
  "id": "n_prompt",
  "type": "prompt",
  "data": {
    "label": "任务说明",
    "nodeType": "prompt",
    "prompt": "生成一套符合指定结构的原创试卷"
  },
  "position": { "x": 0, "y": 0 }
}
```

## output-project-path — 项目内路径输出

```json
{
  "id": "n_project_output",
  "type": "output-project-path",
  "data": {
    "label": "项目成品",
    "nodeType": "output-project-path",
    "path": "outputs/final"
  },
  "position": { "x": 1000, "y": 0 }
}
```

Canvas Agent 当前不要创建 `condition`、`decision`、`compound` 或子节点。需要质量复核和迭代改进时，使用 Operation 节点的 `loopEnabled`、`maxLoopCount` 和 `loopConditionPrompt`。
