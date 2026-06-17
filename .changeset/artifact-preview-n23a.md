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

工件预览能力线 Phase A（N23-01~03）：新增工件描述 schema（NodeArtifact/ArtifactKind/ArtifactFile）、节点产物只读读取后端（artifactsService + tRPC，防目录穿越 + 512KB 截断）、ArtifactPreview 渲染组件（按 contentType 路由 html/image/md/code/text + dir 文件树，iframe 沙箱禁 allow-same-origin）。
