# Pipeline 创建指南

## 通过 CLI 创建

> CLI 当前支持列出 Pipeline 和运行 Pipeline。创建 Pipeline 需要使用 REST API。

```bash
# 设置 API 地址（默认 http://localhost:9433）
export ORDINE_API_URL=http://localhost:9433

# 列出所有 Pipeline
ordine pipelines
# 或
ordine ls

# 运行 Pipeline（带自动 follow）
ordine run pipe_check_classname

# 运行 Pipeline 并指定输入路径
ordine run pipe_check_classname -i ./src

# Fire and forget（不等待完成）
ordine run pipe_check_classname --no-follow
```

## 通过 REST API 创建

### Step 1: 确认所需 Operation 已存在

```bash
# 列出所有 Operations
curl -s http://localhost:9433/api/operations | python3 -m json.tool

# 如果需要的 Operation 不存在，先创建它（参见 ordine-create-operation skill）
```

### Step 2: 构建 Pipeline JSON

```bash
curl -s -X POST http://localhost:9433/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pipe_check_classname",
    "name": "检查 ClassName 规范",
    "description": "扫描项目中的 className 模板字符串违规",
    "tags": ["check", "classname", "frontend"],
    "nodes": [
      {
        "id": "n_input",
        "type": "folder",
        "data": {
          "label": "源代码目录",
          "nodeType": "folder",
          "folderPath": "",
          "description": "要检查的源代码目录"
        },
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "n_check",
        "type": "operation",
        "data": {
          "label": "扫描 ClassName 违规",
          "nodeType": "operation",
          "operationId": "op_scan_classname",
          "operationName": "扫描 ClassName 违规",
          "status": "idle"
        },
        "position": { "x": 500, "y": 0 }
      },
      {
        "id": "n_output",
        "type": "output-local-path",
        "data": {
          "label": "检查报告",
          "nodeType": "output-local-path",
          "localPath": ".ordine/results/classname-report",
          "outputMode": "overwrite",
          "dualOutput": true,
          "description": "ClassName 规范检查报告"
        },
        "position": { "x": 1000, "y": 0 }
      }
    ],
    "edges": [
      { "id": "e_in_check", "source": "n_input", "target": "n_check" },
      { "id": "e_check_out", "source": "n_check", "target": "n_output" }
    ]
  }'
```

### Step 3: 验证

```bash
# 读取创建的 Pipeline
curl -s http://localhost:9433/api/pipelines/pipe_check_classname | python3 -m json.tool
```

## 通过 UI 创建

1. 打开 Ordine App → Pipelines 页面
2. 点击「新建 Pipeline」
3. 在画布中拖拽添加节点
4. 连接节点形成 DAG
5. 配置每个节点的属性
6. 保存

## 常见 Pipeline 模板

### 单项检查

```
[folder] → [op_check_xxx] → [output]
```

### 检查 + 修复

```
[folder] → [op_check_xxx] → [op_fix_xxx] → [output]
```

### 并发多项检查

```
         ┌→ [op_check_a] → [output_a]
[folder] ├→ [op_check_b] → [output_b]
         └→ [op_check_c] → [output_c]
```

## 命名约定

- Pipeline ID: `pipe_<verb>_<noun>` (如 `pipe_check_dao`, `pipe_check_fix_store`)
- 检查类: `pipe_check_xxx`
- 修复类: `pipe_fix_xxx`
- 检查+修复: `pipe_check_fix_xxx`
