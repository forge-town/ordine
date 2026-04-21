# Pipeline 运行故障排查

## 常见问题

### 1. Job 状态卡在 pending

**症状**：Job 创建后状态一直是 `pending`，不变为 `running`。

**可能原因**：
- Pipeline Runner 服务未启动
- Job 队列阻塞

**排查步骤**：
```bash
# 检查 server 是否正常运行
curl -s http://localhost:9433/health

# 检查 Job 详情
curl -s http://localhost:9433/api/jobs/<job-id> | python3 -m json.tool
```

### 2. Job 状态变为 failed

**症状**：Job 的 `status` 为 `failed`。

**排查步骤**：
```bash
# 查看 Job 详情，关注 result 字段
curl -s http://localhost:9433/api/jobs/<job-id> | python3 -m json.tool

# result 字段可能包含错误信息
```

**常见原因**：
- Pipeline 中引用的 Operation 不存在
- Operation 的 executor skill 不存在
- 输入数据类型不匹配

### 3. Pipeline 不存在

```bash
# 确认 Pipeline ID 正确
curl -s http://localhost:9433/api/pipelines | python3 -m json.tool

# 查看所有 Pipeline 列表
```

### 4. Operation 执行失败

**排查链路**：Pipeline → Node → Operation → Skill

```bash
# 1. 看 Pipeline 中有哪些 operation 节点
curl -s http://localhost:9433/api/pipelines/<pipeline-id> | python3 -c "
import sys, json
p = json.load(sys.stdin)
nodes = json.loads(p.get('nodes','[]')) if isinstance(p.get('nodes'), str) else p.get('nodes', [])
for n in nodes:
    if n.get('type') == 'operation':
        print(f\"Node: {n['id']} → Operation: {n['data'].get('operationId')}\")
"

# 2. 检查具体 Operation
curl -s http://localhost:9433/api/operations/<operation-id> | python3 -m json.tool

# 3. 检查 Operation 的 executor skill
# 从 operation 的 config 中提取 skillId
curl -s http://localhost:9433/api/skills/<skill-id> | python3 -m json.tool
```

## 调试技巧

### 查看 Server 日志

直接查看 server 进程的终端输出，能看到请求日志和错误信息。

### 简化测试

如果复杂 Pipeline 失败，先创建只有一个 Operation 的简单 Pipeline 测试：

```bash
# 创建最简 Pipeline
curl -X POST http://localhost:9433/api/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "id": "pipe_test_single",
    "name": "单节点测试",
    "nodes": "[{\"id\":\"n1\",\"type\":\"folder\",\"data\":{\"path\":\"src/\"}},{\"id\":\"n2\",\"type\":\"operation\",\"data\":{\"operationId\":\"op_check_dao\"}}]",
    "edges": "[{\"source\":\"n1\",\"target\":\"n2\"}]"
  }'

# 运行
curl -X POST http://localhost:9433/api/pipelines/pipe_test_single/run

# 检查结果
# ...

# 清理
curl -X DELETE http://localhost:9433/api/pipelines/pipe_test_single
```
