# 创建 Recipe 指南

## 通过 CLI

> CLI 当前不直接支持 Recipe CRUD。使用 REST API 操作。

## 通过 REST API 创建

### 1. 确认前置条件

在创建 Recipe 之前，确保 Operation 和 Best Practice 都已存在：

```bash
# 确认 Operation 存在
curl -s http://localhost:9431/api/operations/<operation-id> | python3 -m json.tool

# 确认 Best Practice 存在
curl -s http://localhost:9431/api/best-practices/<best-practice-id> | python3 -m json.tool
```

### 2. 创建 Recipe

```bash
curl -X POST http://localhost:9431/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rcp_check_classname",
    "name": "检查 className 规范",
    "description": "使用 className 检查操作来验证 cn() 使用规范",
    "operationId": "op_check_classname",
    "bestPracticeId": "bp_classname_convention"
  }'
```

### 3. 查看已有 Recipe

```bash
# 列出所有
curl -s http://localhost:9431/api/recipes | python3 -m json.tool
```

### 4. 更新 Recipe（PUT = upsert）

```bash
curl -X PUT http://localhost:9431/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rcp_check_classname",
    "name": "检查 className 规范（v2）",
    "description": "升级版 className 检查",
    "operationId": "op_check_classname_v2",
    "bestPracticeId": "bp_classname_convention"
  }'
```

## 创建步骤

### Step 1: 识别绑定关系

问自己：
- 我要检查/修复哪条规范？→ 找到 Best Practice ID
- 我要用什么操作来执行？→ 找到 Operation ID

### Step 2: 检查是否已有绑定

```bash
# 列出所有 recipe，检查是否已有同样的 operationId + bestPracticeId 组合
curl -s http://localhost:9431/api/recipes | python3 -c "
import sys, json
recipes = json.load(sys.stdin)
for r in recipes:
    print(f\"{r['id']}: {r.get('operationId')} + {r.get('bestPracticeId')}\")
"
```

### Step 3: 创建 Recipe

使用 POST API 创建。

### Step 4: 验证

确认 Recipe 创建成功，且 operationId 和 bestPracticeId 都指向有效记录。

## 常见模式

### Check + Fix 配对

为同一条规范创建两个 Recipe：

```bash
# 检查 Recipe
curl -X POST http://localhost:9431/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rcp_check_barrel",
    "name": "检查桶导出规范",
    "operationId": "op_check_barrel_export",
    "bestPracticeId": "bp_barrel_export"
  }'

# 修复 Recipe
curl -X POST http://localhost:9431/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "rcp_fix_barrel",
    "name": "修复桶导出问题",
    "operationId": "op_fix_barrel_export",
    "bestPracticeId": "bp_barrel_export"
  }'
```

### 全量检查

一个 Operation 检查多条规范时，为每条创建 Recipe：

```bash
for bp in bp_classname_convention bp_barrel_export bp_one_component_per_file; do
  curl -X POST http://localhost:9431/api/recipes \
    -H "Content-Type: application/json" \
    -d "{
      \"id\": \"rcp_all_${bp#bp_}\",
      \"name\": \"全量检查: ${bp}\",
      \"operationId\": \"op_check_all\",
      \"bestPracticeId\": \"${bp}\"
    }"
done
```
