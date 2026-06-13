# @repo/agent

**职责：runtime 适配层（adapters）。** 把每个具体 LLM/agent 运行时（`claude-code` / `codex` / `hermes` / `mastra` / `openclaw`）的进程启动、参数透传、流式输出与原生事件解析封装成一个 `run<Runtime>` 函数。本包**只**关心"如何调用某个 runtime"，不做调度、观测、重试或业务编排。

边界（与 `@repo/agent-engine` 的分工，H1-05 厘清）：

- 本包导出 `runClaude` / `runCodex` / `runHermes` / `runMastra` / `runOpenclaw`，以及各 runtime 的输入/输出 schema、`extractJsonFromText`（runtime 无关的 JSON 提取工具，已自 claude 适配器迁出至 `src/json/`，H1-02）。
- 不依赖 `@repo/agent-engine`、`@repo/services`、`@repo/pipeline-engine`。调度与观测在上层。
- claude 专属的 `ClaudeStreamEvent` 等类型属于本包内部细节，不应出现在 `@repo/agent-engine` 的公开契约里（H1-03）。

新增一个 runtime：在 `src/<runtime>/` 下实现 `run<Runtime>`，导出，再到 `@repo/agent-engine` 的 `drivers.ts` 注册到 `DRIVERS`。
