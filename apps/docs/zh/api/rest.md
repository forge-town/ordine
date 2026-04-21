# REST API

Ordine 通过 Hono 提供 REST API，运行在 `http://localhost:9433`。

## 流水线

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/pipelines` | 获取所有流水线 |
| `GET` | `/api/pipelines/:id` | 获取单个流水线 |
| `POST` | `/api/pipelines` | 创建流水线 |
| `PUT` | `/api/pipelines/:id` | 更新流水线 |
| `DELETE` | `/api/pipelines/:id` | 删除流水线 |
| `POST` | `/api/pipelines/:id/run` | 运行流水线 |

## 操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/operations` | 获取所有操作 |
| `GET` | `/api/operations/:id` | 获取单个操作 |
| `POST` | `/api/operations` | 创建操作 |
| `PUT` | `/api/operations/:id` | 更新操作 |
| `DELETE` | `/api/operations/:id` | 删除操作 |

## 技能

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/skills` | 获取所有技能 |
| `GET` | `/api/skills/:id` | 获取单个技能 |
| `POST` | `/api/skills` | 创建技能 |
| `PUT` | `/api/skills/:id` | 更新技能 |
| `DELETE` | `/api/skills/:id` | 删除技能 |

## 最佳实践

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/best-practices` | 获取所有最佳实践 |
| `GET` | `/api/best-practices/:id` | 获取单个最佳实践 |
| `POST` | `/api/best-practices` | 创建最佳实践 |
| `PUT` | `/api/best-practices/:id` | 更新最佳实践 |
| `DELETE` | `/api/best-practices/:id` | 删除最佳实践 |

## 规则

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/rules` | 获取所有规则 |
| `GET` | `/api/rules/:id` | 获取单个规则 |
| `POST` | `/api/rules` | 创建规则 |
| `PUT` | `/api/rules/:id` | 更新规则 |
| `DELETE` | `/api/rules/:id` | 删除规则 |

## 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/jobs` | 获取所有任务 |
| `GET` | `/api/jobs/:id` | 获取单个任务 |
| `DELETE` | `/api/jobs/:id` | 删除任务 |

## 食谱

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/recipes` | 获取所有食谱 |
| `GET` | `/api/recipes/:id` | 获取单个食谱 |
| `POST` | `/api/recipes` | 创建食谱 |
| `PUT` | `/api/recipes/:id` | 更新食谱 |
| `DELETE` | `/api/recipes/:id` | 删除食谱 |

## 文件系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/filesystem` | 浏览文件系统 |
| `GET` | `/api/filesystem/file` | 读取文件内容 |

## 代码片段

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/code-snippets` | 获取所有代码片段 |
| `POST` | `/api/code-snippets` | 创建代码片段 |
| `PUT` | `/api/code-snippets/:id` | 更新代码片段 |
| `DELETE` | `/api/code-snippets/:id` | 删除代码片段 |

## 检查清单项

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/checklist-items` | 获取所有检查清单项 |
| `POST` | `/api/checklist-items` | 创建检查清单项 |
| `PUT` | `/api/checklist-items/:id` | 更新检查清单项 |
| `DELETE` | `/api/checklist-items/:id` | 删除检查清单项 |

## 通用模式

### 分页

所有列表端点支持分页：

```
GET /api/pipelines?page=1&pageSize=20
```

### 响应格式

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

### 错误响应

```json
{
  "error": {
    "message": "未找到",
    "code": "NOT_FOUND"
  }
}
```
