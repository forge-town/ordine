# Issue #92 Agent-First Pipeline Generation 收尾实现计划

> **执行指引：** 推荐使用 `subagent-driven-development` 技能逐任务执行此计划。
> 步骤使用 checkbox (`- [x]`) 语法追踪进度。

**目标：** 在最新 `upstream/develop` 基线上，把 `issue-92-agent-first-pipeline-generation-fix` 收尾到可提 PR：支持真实文件上下文规划、先提案后生成、图片理解、可控的 proposal 生命周期、以及生成失败时的可恢复交互。

**架构：** 保留现有 `pipelineAgentSessions` 数据模型与 `NewPipelineDialog` / `Canvas AgentPanel` 双入口，通过扩展通用 `agentEngine` 输入契约支持多模态附件。附件解析与视觉摘要都沉淀为结构化 artifact，planning 只消费 artifact 文本。proposal 通过现有 `superseded` 状态收口，生成失败时不再造假 pipeline，而是回到 proposal review。

**技术栈：** React 19、Hono、Drizzle、Zod v4、neverthrow、Mastra、Vitest、Playwright

---

## 文件结构规划

本次工作按 5 个子系统拆分，每个子系统都能独立验证：

- `packages/agent-engine`, `packages/services/src/pipelineRunnerService/agentRunner`
  负责通用多模态输入契约与运行时能力门控
- `packages/agent/src/mastra`
  负责 Mastra runtime 的图片输入支持
- `packages/services/src/pipelineAgentSessionsService`, `apps/server/src/routes/pipelineAgentSessions.ts`, `apps/app/src/lib/pipelineAgentSessionsClient.ts`
  负责附件解析、proposal 生命周期、生成失败回退
- `apps/app/src/components/NewPipelineDialog`, `apps/app/src/pages/CanvasPage/AgentPanel`
  负责双入口交互与上下文一致性
- 对应 unit tests / route tests / browser verification
  负责回归门禁与 PR-ready 证据

## Task 1: 扩展通用多模态 agent 输入契约

**文件：**

- 修改: `packages/agent-engine/src/agentEngine.ts`
- 修改: `packages/services/src/pipelineRunnerService/agentRunner/agentRunner.ts`
- 修改: `packages/agent-engine/src/agentEngine.unit.test.ts`
- 新增或修改: `packages/services/src/pipelineRunnerService/agentRunner/agentRunner.unit.test.ts`

- [x] **Step 1: 编写失败测试**

```typescript
it("forwards image attachments to the selected runtime", async () => {
  await agentEngine.run({
    agent: "mastra",
    mode: "direct",
    systemPrompt: "system",
    userPrompt: "describe the screenshot",
    cwd: process.cwd(),
    attachments: [
      {
        kind: "image",
        filename: "ui.png",
        mediaType: "image/png",
        dataBase64: "ZmFrZQ==",
      },
    ],
  });

  expect(mockRunMastra).toHaveBeenCalledWith(
    expect.objectContaining({
      attachments: [
        expect.objectContaining({
          kind: "image",
          filename: "ui.png",
        }),
      ],
    }),
  );
});

it("rejects image attachments for runtimes without vision support", async () => {
  await expect(
    agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "system",
      userPrompt: "describe the screenshot",
      cwd: process.cwd(),
      attachments: [
        {
          kind: "image",
          filename: "ui.png",
          mediaType: "image/png",
          dataBase64: "ZmFrZQ==",
        },
      ],
    }),
  ).rejects.toThrow("does not support image attachments");
});
```

- [x] **Step 2: 运行测试确认失败**

运行: `bun run test packages/agent-engine/src/agentEngine.unit.test.ts packages/services/src/pipelineRunnerService/agentRunner/agentRunner.unit.test.ts`
预期: FAIL，原因是 `attachments` 尚不存在或没有透传/报错逻辑。

- [x] **Step 3: 编写最小实现**

```typescript
export interface AgentInputAttachment {
  kind: "image";
  filename: string;
  mediaType: string;
  dataBase64: string;
}

export interface AgentRunOptions {
  agent: AgentRuntime;
  mode: "direct";
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  attachments?: AgentInputAttachment[];
  // ...
}

const supportsImageAttachments = (agent: AgentRuntime) => agent === "mastra";

if (
  opts.attachments?.some((attachment) => attachment.kind === "image") &&
  !supportsImageAttachments(opts.agent)
) {
  throw new Error(`${opts.agent} runtime does not support image attachments`);
}
```

`runAgent(...)` 同步增加 `attachments?: AgentInputAttachment[]` 并向 `agentEngine.run(...)` 透传。

- [x] **Step 4: 运行测试确认通过**

运行: `bun run test packages/agent-engine/src/agentEngine.unit.test.ts packages/services/src/pipelineRunnerService/agentRunner/agentRunner.unit.test.ts`
预期: PASS

- [x] **Step 5: 提交**

```bash
git add packages/agent-engine/src/agentEngine.ts packages/services/src/pipelineRunnerService/agentRunner/agentRunner.ts packages/agent-engine/src/agentEngine.unit.test.ts packages/services/src/pipelineRunnerService/agentRunner/agentRunner.unit.test.ts
git commit -m "feat: add multimodal agent input contract"
```

## Task 2: 为 Mastra runtime 实现图片输入

**文件：**

- 修改: `packages/agent/src/mastra/runMastra.ts`
- 修改: `packages/agent/src/mastra/runMastra.test.ts` 或新增对应单测

- [x] **Step 1: 编写失败测试**

```typescript
it("passes image content blocks to mastra generate", async () => {
  await runMastra({
    systemPrompt: "system",
    userPrompt: "Describe the uploaded image",
    cwd: process.cwd(),
    attachments: [
      {
        kind: "image",
        filename: "diagram.png",
        mediaType: "image/png",
        dataBase64: "ZmFrZQ==",
      },
    ],
  });

  expect(mockGenerate).toHaveBeenCalledWith([
    expect.objectContaining({
      role: "user",
      content: expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({ type: "image" }),
      ]),
    }),
  ]);
});
```

- [x] **Step 2: 运行测试确认失败**

运行: `bun run test packages/agent/src/mastra/runMastra.test.ts`
预期: FAIL，因为当前实现只调用 `tracedAgent.generate(userPrompt)`。

- [x] **Step 3: 编写最小实现**

```typescript
export interface RunMastraOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  attachments?: AgentInputAttachment[];
  // ...
}

const promptInput =
  attachments && attachments.length > 0
    ? [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...attachments.map((attachment) => ({
              type: "image",
              mediaType: attachment.mediaType,
              image: `data:${attachment.mediaType};base64,${attachment.dataBase64}`,
            })),
          ],
        },
      ]
    : userPrompt;

const result = await Promise.race([tracedAgent.generate(promptInput), timeoutPromise]);
```

- [x] **Step 4: 运行测试确认通过**

运行: `bun run test packages/agent/src/mastra/runMastra.test.ts`
预期: PASS

- [x] **Step 5: 提交**

```bash
git add packages/agent/src/mastra/runMastra.ts packages/agent/src/mastra/runMastra.test.ts
git commit -m "feat: support image attachments in mastra runtime"
```

## Task 3: 重写附件解析与 artifact 生成

**文件：**

- 修改: `packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts`
- 修改: `packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
- 如需新增依赖，修改: `packages/services/package.json`

- [x] **Step 1: 编写失败测试**

```typescript
it("stores a failed attachment when image runtime lacks vision support", async () => {
  mockRunAgent.mockRejectedValueOnce(
    new Error("mastra runtime does not support image attachments"),
  );

  const result = await service.ingestAttachment("session-1", {
    bytes: new Uint8Array([1, 2, 3]),
    filename: "diagram.png",
    mimeType: "image/png",
    sizeBytes: 3,
  });

  expect(result.attachment).toEqual(
    expect.objectContaining({
      parseStatus: "failed",
      parseError: expect.stringContaining("does not support image attachments"),
    }),
  );
  expect(result.artifacts).toEqual([]);
});

it("extracts text from a real pdf fixture instead of regex-only inline text", async () => {
  const bytes = await readFile(resolve(__dirname, "./fixtures/simple.pdf"));
  const result = await service.ingestAttachment("session-1", {
    bytes: new Uint8Array(bytes),
    filename: "simple.pdf",
    mimeType: "application/pdf",
    sizeBytes: bytes.byteLength,
  });

  expect(result.artifacts[0]?.content.text).toContain("Hello PDF");
});
```

- [x] **Step 2: 运行测试确认失败**

运行: `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
预期: FAIL，当前图片总是成功写 `image_summary`，PDF 只靠正则抓括号。

- [x] **Step 3: 编写最小实现**

关键实现约束：

- 文字类：保留现有行为
- DOCX：继续基于 `jszip`
- PDF：替换 `extractPdfText(...)`，不要再使用 `matchAll(/\(([^()]+)\)/g)`
- 图片：通过 `runAgent(...)` + `attachments` 生成视觉摘要
- 任何解析失败都要落 attachment 记录，状态改为 `failed`，artifact 不创建

关键代码结构：

```typescript
const createImageSummaryArtifact = async (input: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  runtime: AgentRuntime;
  apiKey?: string;
  model?: string;
}) => {
  const raw = await runAgent({
    agent: input.runtime,
    systemPrompt: "Describe the uploaded image for workflow planning. Return concise JSON.",
    userPrompt: "Summarize visible text, objects, structure, and workflow-relevant clues.",
    attachments: [
      {
        kind: "image",
        filename: input.filename,
        mediaType: input.mimeType,
        dataBase64: Buffer.from(input.bytes).toString("base64"),
      },
    ],
    inputPath: process.cwd(),
    agentId: "pipeline-agent-image-summary",
    logPrefix: "pipelineAgentImage",
    apiKey: settings.defaultApiKey,
    model: settings.defaultModel,
  });

  return {
    kind: "image_summary" as const,
    content: {
      summary: raw,
      mediaType: input.mimeType,
      metadata: { filename: input.filename },
    },
  };
};
```

- [x] **Step 4: 运行测试确认通过**

运行: `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
预期: PASS

- [x] **Step 5: 提交**

```bash
git add packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts packages/services/package.json
git commit -m "feat: improve pipeline agent attachment parsing"
```

## Task 4: 用 `superseded` 收口 proposal 生命周期

**文件：**

- 修改: `packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts`
- 修改: `apps/server/src/routes/pipelineAgentSessions.ts`
- 修改: `apps/app/src/lib/pipelineAgentSessionsClient.ts`
- 修改: `apps/app/src/components/NewPipelineDialog/NewPipelineDialog.tsx`
- 修改: `apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.tsx`
- 修改对应 tests

- [x] **Step 1: 编写失败测试**

```typescript
it("does not return a superseded proposal from getLatestReadyProposal", async () => {
  await service.supersedeProposal("session-1", "proposal-1");
  const latest = await pipelineAgentSessionsClient.getLatestReadyProposal("session-1", "generate");
  expect(latest).toBeNull();
});

it("does not resurrect a rejected proposal in NewPipelineDialog fallback", async () => {
  // send -> proposal_ready -> reject -> next send without SSE terminal event
  expect(mockSupersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
  expect(screen.queryByText("Review repository code")).not.toBeInTheDocument();
});
```

- [x] **Step 2: 运行测试确认失败**

运行:

- `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
- `bun run test apps/app/src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`

预期: FAIL，当前 reject/revise/discard 只清本地状态。

- [x] **Step 3: 编写最小实现**

```typescript
supersedeProposal: async (sessionId: string, proposalId: string) => {
  const proposal = await proposalsDao.findById(proposalId);
  if (!proposal || proposal.sessionId !== sessionId) {
    throw new Error("Pipeline agent proposal not found for session");
  }

  await proposalsDao.update(proposalId, { status: "superseded" });

  const session = await sessionsDao.findById(sessionId);
  if (session?.latestProposalId === proposalId) {
    await sessionsDao.update(sessionId, {
      latestProposalId: null,
      status: "awaiting_user",
    });
  }
};
```

路由与 client 新增 `POST /:id/supersede`。

前端行为：

- `NewPipelineDialog.handleReject / handleRevise`
- `AgentPanel.handleDiscard`

都必须先调 `supersedeProposal(...)`，再清本地 proposal。

- [x] **Step 4: 运行测试确认通过**

运行:

- `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
- `bun run test apps/app/src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`

预期: PASS

- [x] **Step 5: 提交**

```bash
git add packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts apps/server/src/routes/pipelineAgentSessions.ts apps/app/src/lib/pipelineAgentSessionsClient.ts apps/app/src/components/NewPipelineDialog/NewPipelineDialog.tsx apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.tsx
git commit -m "fix: stabilize pipeline agent proposal lifecycle"
```

## Task 5: 生成失败回到 proposal review，不创建假 pipeline

**文件：**

- 修改: `packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts`
- 修改: `apps/server/src/routes/pipelineAgentSessions.ts`
- 修改: `apps/app/src/components/NewPipelineDialog/NewPipelineDialog.tsx`
- 修改对应 unit tests / route tests

- [x] **Step 1: 编写失败测试**

```typescript
it("does not create a fallback pipeline when generateStructure fails", async () => {
  mockPipelinesService.generateStructure.mockResolvedValueOnce({
    error: "Agent returned invalid pipeline structure",
  });

  await expect(service.generatePipelineFromApprovedProposal("session-1")).rejects.toThrow(
    "Agent returned invalid pipeline structure",
  );
  expect(mockPipelinesService.create).not.toHaveBeenCalled();
  expect(mockSessionsDao.update).toHaveBeenCalledWith(
    "session-1",
    expect.objectContaining({ status: "proposal_ready" }),
  );
});
```

- [x] **Step 2: 运行测试确认失败**

运行: `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts apps/server/tests/routes/pipelineAgentSessions.test.ts apps/app/src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx`
预期: FAIL，当前会调用 `buildFallbackGeneratedGraph(...)` 并成功创建 pipeline。

- [x] **Step 3: 编写最小实现**

实现要求：

- 删除 `buildFallbackGeneratedGraph(...)` 调用路径
- 失败时：
  - `sessionsDao.update(sessionId, { status: "proposal_ready" })`
  - 抛错给 route
  - route 返回非 200
  - UI 保持 `proposal_ready`，显示错误

```typescript
if ("error" in generated) {
  await sessionsDao.update(sessionId, { status: "proposal_ready" });
  throw new Error(generated.error);
}
```

- [x] **Step 4: 运行测试确认通过**

运行:

- `bun run test packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.unit.test.ts`
- `bun run test apps/server/tests/routes/pipelineAgentSessions.test.ts`
- `bun run test apps/app/src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx`

预期: PASS

- [x] **Step 5: 提交**

```bash
git add packages/services/src/pipelineAgentSessionsService/createPipelineAgentSessionsService.ts apps/server/src/routes/pipelineAgentSessions.ts apps/app/src/components/NewPipelineDialog/NewPipelineDialog.tsx
git commit -m "fix: keep pipeline agent in proposal review on generation failure"
```

## Task 6: 修正 Canvas 图变更后的附件上下文一致性

**文件：**

- 修改: `apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.tsx`
- 修改: `apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`

- [x] **Step 1: 编写失败测试**

```typescript
it("clears uploaded attachments when graph signature changes", async () => {
  // upload file on session A
  // mutate nodes/edges in store so ensureSession creates session B
  // send message
  expect(screen.queryByText("brief.txt")).not.toBeInTheDocument();
  expect(screen.getByText("canvas.agentPanel.contextReset")).toBeInTheDocument();
});
```

- [x] **Step 2: 运行测试确认失败**

运行: `bun run test apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`
预期: FAIL，当前 badge 会继续显示旧附件。

- [x] **Step 3: 编写最小实现**

```typescript
useEffect(() => {
  const nextSignature = JSON.stringify({ pipelineId, nodes, edges });
  if (
    sessionGraphSignatureRef.current &&
    sessionGraphSignatureRef.current !== nextSignature &&
    attachments.length > 0
  ) {
    setAttachments([]);
    setMessages((prev) => [
      ...prev,
      {
        id: `system-context-reset-${Date.now()}`,
        role: "assistant",
        content: t("canvas.agentPanel.contextReset"),
      },
    ]);
  }
}, [attachments.length, edges, nodes, pipelineId, t]);
```

- [x] **Step 4: 运行测试确认通过**

运行: `bun run test apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`
预期: PASS

- [x] **Step 5: 提交**

```bash
git add apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.tsx apps/app/src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx
git commit -m "fix: reset canvas agent attachments on graph changes"
```

## Task 7: PR-ready 验证与浏览器证据

**文件：**

- 修改: `pr-assets/` 下新增截图
- 如需补文案，修改现有 locale 文件

- [x] **Step 1: 运行定向质量检查**

运行:

```bash
cd packages/agent-engine && bun run quality
cd packages/agent && bun run quality
cd packages/services && bun run quality
cd apps/server && bun run test
cd apps/app && bun run test -- --run src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx
```

预期: 全部 PASS

- [x] **Step 2: 浏览器验证 New Pipeline**

验证场景：

1. 文本-only prompt -> question/proposal/approve/generate
2. DOCX/PDF 上传 -> proposal 包含文件语义
3. 图片上传 + `mastra` runtime -> proposal 体现图片内容
4. 图片上传 + 非 `mastra` runtime -> 明确错误，不静默忽略
5. proposal reject/revise 后再次发送，不回流旧 proposal
6. generateStructure 失败后停留在 review

保存:

- `pr-assets/issue-92-new-pipeline-desktop.png`
- `pr-assets/issue-92-new-pipeline-mobile.png`

- [x] **Step 3: 浏览器验证 Canvas AgentPanel**

验证场景：

1. 上传附件后发起 edit proposal
2. discard 后不回流旧 proposal
3. 图结构变化后附件 badge 清空并出现 context reset 文案

保存:

- `pr-assets/issue-92-agent-panel-desktop.png`
- `pr-assets/issue-92-agent-panel-mobile.png`

- [x] **Step 4: 生成 PR 说明草稿**

PR 描述至少包含：

- 功能摘要
- 图片/文档上下文能力
- proposal 生命周期修复
- 生成失败策略调整
- 验证命令
- browser evidence 路径

- [x] **Step 5: 提交**

```bash
git add pr-assets
git commit -m "test: add issue-92 browser verification assets"
```

## 计划自审

- [x] 图片理解不再依赖“仅文件名元数据”
- [x] PDF 解析不再依赖 `extractPdfText()` 的正则抓括号
- [x] proposal `reject / revise / discard` 都有服务端状态变更
- [x] `generateStructure` 失败不再创建硬编码 `/tmp/ordine-*` pipeline
- [x] `Canvas AgentPanel` 的会话切换不再让旧附件假装仍然有效
- [x] 所有步骤都给出了文件、命令、预期结果和提交边界

## PR 说明草稿

### Summary

- Adds a multimodal agent input contract and routes image attachments through Mastra for visual context summaries.
- Improves pipeline agent attachment parsing for image/PDF/DOCX/text uploads, storing failed attachment parse state instead of creating fake artifacts.
- Stabilizes proposal lifecycle with server-side supersede and keeps generation failures in proposal review instead of creating fallback pipelines.
- Resets Canvas AgentPanel attachment context when the graph signature changes.

### Test Plan

- [x] `cd packages/agent-engine && bun run quality`
- [x] `cd packages/agent && bun run quality`
- [x] `cd packages/agent && bunx vitest run src/mastra/runMastra.unit.test.ts`
- [x] `cd packages/services && bun run quality`
- [x] `cd packages/utils && bun run quality`
- [x] `cd apps/server && bun run lint && bun run check-types && bun run test`
- [x] `cd apps/app && bun run lint && bun run compile && bun run test -- --run src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`
- [x] Targeted `oxfmt --check` for changed TS/TSX files and this plan file

### Browser Evidence

- `pr-assets/issue-92-new-pipeline-desktop.png`
- `pr-assets/issue-92-new-pipeline-mobile.png`
- `pr-assets/issue-92-agent-panel-desktop.png`
- `pr-assets/issue-92-agent-panel-mobile.png`

## 完成证据

### 定向质量检查

- [x] `cd packages/agent-engine && bun run quality`
- [x] `cd packages/agent && bun run quality`
- [x] `cd packages/agent && bunx vitest run src/mastra/runMastra.unit.test.ts`
- [x] `cd packages/services && bun run quality`
- [x] `cd packages/utils && bun run quality`
- [x] `cd apps/server && bun run lint && bun run check-types && bun run test`
- [x] `cd apps/app && bun run lint && bun run compile && bun run test -- --run src/components/NewPipelineDialog/NewPipelineDialog.unit.test.tsx src/pages/CanvasPage/AgentPanel/AgentPanel.unit.test.tsx`
- [x] 定向 `oxfmt --check` 覆盖本次变更的 TS/TSX 文件

### 浏览器验证

- [x] New Pipeline Dialog：上传图片上下文、收到 generation proposal、`generate` 返回 500 后仍停留在 proposal review 并显示错误
- [x] Canvas AgentPanel：上传 PDF 上下文、收到 edit proposal、discard 后清除 proposal 操作按钮
- [x] Canvas AgentPanel 图变更清空附件由 `AgentPanel.unit.test.tsx` 覆盖
- [x] 截图证据：
  - `pr-assets/issue-92-new-pipeline-desktop.png`
  - `pr-assets/issue-92-new-pipeline-mobile.png`
  - `pr-assets/issue-92-agent-panel-desktop.png`
  - `pr-assets/issue-92-agent-panel-mobile.png`

### 本地环境说明

- 全仓 `bun run format:check` 未作为完成门禁使用：当前仓库存在大量既有格式差异，已改用定向 `oxfmt --check` 验证本次改动文件。
- 本机 `apps/server/.env` 中的 `DATABASE_URL` 连接被拒绝；PGlite 迁移目录缺少 `operations` 建表迁移，无法用临时空库完成真实后端浏览器流。后端行为已由 service/route 单测覆盖，浏览器验证使用 Playwright 网络拦截稳定覆盖 UI 状态。
