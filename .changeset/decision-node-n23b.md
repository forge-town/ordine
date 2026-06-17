---
"@repo/oxc-formatter-config": patch
"@repo/typescript-config": patch
"@repo/pipeline-engine": patch
"@repo/oxlint-config": patch
"@repo/agent-engine": patch
"@repo/db-schema": patch
"@repo/services": patch
"@repo/plugins": patch
"@repo/schemas": patch
"@repo/logger": patch
"@repo/models": patch
"@repo/plugin": patch
"@repo/shared": patch
"@repo/agent": patch
"@repo/utils": patch
"@ordine/scripts": patch
"@repo/obs": patch
"@ordine/create": patch
"@ordine/server": patch
"@repo/db": patch
"@repo/ui": patch
"@ordine/docs": patch
"@ordine/app": patch
"@ordine/cli": patch
---

人类决策节点能力线 Phase B（N23-04~06）：新增 decision 节点类型（MetaNodeType/BuiltinNodeType/判别联合 + 连接规则）、引擎决策执行（复用暂停管道，逐入边收集候选 + waitForDecision/resolveDecision，禁伪造决策）、DecisionBoard 候选对比 UI（内嵌 ArtifactPreview，单/多选 + jobs.resolveDecision tRPC）。
