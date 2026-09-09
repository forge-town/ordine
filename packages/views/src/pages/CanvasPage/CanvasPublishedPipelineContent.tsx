import { useEffect } from "react";
import { Button } from "@repo/ui/button";
import type { PipelineDefinition } from "@repo/schemas";
import { ExecutionRequestCard } from "../../components/ExecutionRequest/ExecutionRequestCard";
import { useOptionalAgentControlStore } from "../../components/GlobalAgentControl";
import { CanvasAgentControlPanel } from "./AgentControlBridge";
import { CanvasPublishedGraph } from "./CanvasPublishedGraph";
import { CanvasPublishedInputs } from "./CanvasPublishedInputs";
import { usePublishedPipelineRun } from "./usePublishedPipelineRun";

export const CanvasPublishedPipelineContent = ({
  pipeline,
  onReload,
}: {
  pipeline: PipelineDefinition;
  onReload?: () => void;
}) => {
  const run = usePublishedPipelineRun(pipeline);
  const agentStore = useOptionalAgentControlStore();
  useEffect(() => {
    if (!agentStore) return;
    agentStore.getState().registerCanvasSurface(null);
    agentStore.getState().setCanvasSurfaceOpen(true);
    agentStore.getState().updateContext({
      pipelineId: pipeline.id,
      selectedNodeIds: [],
      selectedResources: [{ type: "pipeline", id: pipeline.id, label: pipeline.name }],
    });

    return () => {
      agentStore.getState().setCanvasSurfaceOpen(false);
      agentStore
        .getState()
        .updateContext({ pipelineId: null, selectedNodeIds: [], selectedResources: [] });
    };
  }, [agentStore, pipeline.id, pipeline.name]);
  const request = run.state.submission.request;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-background p-3 min-[1181px]:flex-row min-[1181px]:overflow-hidden"
      data-testid="canvas-published-pipeline"
    >
      <main className="min-w-0 flex-1 space-y-4 min-[1181px]:overflow-y-auto min-[1181px]:pr-1">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <h1 className="break-words text-lg font-semibold">{pipeline.name}</h1>
            <p className="text-sm text-muted-foreground">
              已发布 · 修订 {pipeline.revision} · 只读查看
            </p>
          </div>
          <Button disabled={run.locked} onClick={() => void run.submit()}>
            {run.state.pendingAction ?? (request ? "运行请求已提交" : "运行此修订")}
          </Button>
        </header>
        <p className="text-sm text-muted-foreground">
          此 Pipeline 没有作者草稿。可查看并运行已发布定义；不会自动创建或覆盖草稿。
        </p>
        {pipeline.description && (
          <p className="whitespace-pre-wrap text-sm">{pipeline.description}</p>
        )}
        <CanvasPublishedGraph pipeline={pipeline} />
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-semibold">已发布输入</h2>
          <CanvasPublishedInputs
            ports={pipeline.graph.inputs}
            drafts={run.drafts}
            onChange={run.setDrafts}
            disabled={run.locked}
            onBusyChange={run.setInputBusy}
          />
        </section>
        <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-semibold">已发布输出</h2>
          {pipeline.graph.outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有声明图级输出。</p>
          ) : (
            pipeline.graph.outputs.map((output) => (
              <p key={output.port.id} className="break-all text-sm">
                {output.port.id} · {output.port.valueType} · {output.port.cardinality} ←{" "}
                {output.source.nodeId}/{output.source.portId}
              </p>
            ))
          )}
        </section>
        {run.state.error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
          >
            {run.state.error}
          </p>
        )}
        {request && (
          <section className="space-y-3" aria-label="本次运行请求">
            <p className="text-sm text-muted-foreground">
              本次请求使用修订 {request.expectedRevision}；请查询原请求确认结果。
            </p>
            {run.state.submission.phase === "submitting" ? (
              <p role="status">正在提交运行请求…</p>
            ) : run.state.submission.phase === "invalid" && !run.state.submission.receipt ? (
              <div className="space-y-2">
                <p role="status">请求未被接受，请重新加载已发布定义后再次运行。</p>
                {onReload && (
                  <Button variant="outline" onClick={onReload}>
                    重新读取已发布定义
                  </Button>
                )}
              </div>
            ) : (
              <ExecutionRequestCard
                requestId={request.requestId}
                onReceipt={run.onReceipt}
                onJob={run.onJob}
              />
            )}
            {run.canReset && (
              <Button variant="outline" onClick={run.reset}>
                准备再次运行当前修订
              </Button>
            )}
          </section>
        )}
      </main>
      <aside
        className="h-96 shrink-0 overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-raised min-[1181px]:h-full min-[1181px]:w-[344px]"
        aria-label="AgentBar"
      >
        <CanvasAgentControlPanel />
      </aside>
    </div>
  );
};
