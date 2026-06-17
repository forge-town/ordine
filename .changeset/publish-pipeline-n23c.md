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

多文件捕获 + Git 发布能力线 Phase C（N23-07~09）：捕获 agent outputDir 为 dir 工件（@@NODE_ARTIFACT trace → LastRunSection 文件树预览）、Publish 执行器 + gitPublisher（发布 dir 工件到 git 仓库 PR 优先 / 本地目录，永不直推默认分支、缺凭证不静默）、Publish 执行器配置 UI（OperationEditForm publish 子表单）。
