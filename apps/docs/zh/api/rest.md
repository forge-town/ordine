# REST API

Ordine 服务器默认在端口 `9433` 暴露 REST API，所有端点以 `/api/` 为前缀。

## 基础 URL

```
http://localhost:9433/api
```

## 资源

### 流水线

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/pipelines` | 列出所有流水线 |
| `POST` | `/pipelines` | 创建流水线 |
| `PUT` | `/pipelines` | Upsert 流水线 |
| `GET` | `/pipelines/:id` | 获取单个流水线 |
| `PATCH` | `/pipelines/:id` | 更新流水线 |
| `DELETE` | `/pipelines/:id` | 删除流水线 |
| `POST` | `/pipelines/:id/run` | 运行流水线 |

#### 运行流水线

```sh
curl -X POST http://localhost:9433/api/pipelines/my-pipeline/run \
  -H 'Content-Type: application/json' \
  -d '{"inputPath": "/path/to/project"}'
```

响应：
```json
{ "jobId": "d1612c1b-cd83-4936-b3db-8777847b1871" }
```

### 操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/operations` | 列出所有操作 |
| `POST` | `/operations` | 创建操作 |
| `PUT` | `/operations` | Upsert 操作 |
| `GET` | `/operations/:id` | 获取单个操作 |
| `PATCH` | `/operations/:id` | 更新操作 |
| `DELETE` | `/operations/:id` | 删除操作 |

### 技能

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/skills` | 列出所有技能 |
| `POST` | `/skills` | 创建技能 |
| `GET` | `/skills/:id` | 获取单个技能 |
| `PATCH` | `/skills/:id` | 更新技能 |
| `DELETE` | `/skills/:id` | 删除技能 |

### 最佳实践

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/best-practices` | 列出所有最佳实践 |
| `PUT` | `/best-practices` | Upsert 最佳实践 |
| `DELETE` | `/best-practices/:id` | 删除最佳实践 |

### 规则

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/rules` | 列出所有规则 |
| `PUT` | `/rules` | Upsert 规则 |
| `DELETE` | `/rules/:id` | 删除规则 |

### 配方

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/recipes` | 列出所有配方 |
| `POST` | `/recipes` | 创建配方 |
| `PUT` | `/recipes` | Upsert 配方 |
| `DELETE` | `/recipes/:id` | 删除配方 |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/jobs` | 列出所有任务 |
| `GET` | `/jobs/:id` | 获取单个任务 |
| `GET` | `/jobs/:id/traces` | 获取任务追踪 |
| `DELETE` | `/jobs/:id` | 删除任务 |

### 文件系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/filesystem` | 浏览文件系统 |

### 代码片段

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/code-snippets` | 列出代码片段 |
| `PUT` | `/code-snippets` | Upsert 代码片段 |
| `DELETE` | `/code-snippets` | 删除代码片段 |

### 检查清单项

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/checklist-items` | 列出检查清单项 |
| `PUT` | `/checklist-items` | Upsert 检查清单项 |
| `DELETE` | `/checklist-items` | 删除检查清单项 |

## 通用模式

### Upsert

大多数资源支持 `PUT` 进行 upsert — 请求体中包含 `id` 字段。如果 ID 存在则更新，否则创建。
