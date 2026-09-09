import { useWorkspaceData } from "./useWorkspaceData";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { PipelineWorkspace } from "./PipelineWorkspace";
import { OperationEditor } from "./OperationEditor";
import { RunPanel } from "./RunPanel";
export const ExecutionWorkspacePageContent = () => {
  const { state, store, readiness, busy } = useWorkspaceData();
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void readiness.query.refetch();
  const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    store.getState().patch({ error: null });

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-7">
        <div>
          <h1 className="text-xl font-semibold">执行工作台</h1>
          <p className="text-sm text-muted-foreground">定义流程，审阅运行，再核对真实交付。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {readiness.query.isLoading
              ? "连接服务…"
              : readiness.result?.status === "ready"
                ? `v2 已就绪 · ${readiness.result.mode}`
                : "服务未就绪"}
          </span>
          <Button size="sm" variant="ghost" onClick={handleClick1}>
            检查连接
          </Button>
        </div>
        <nav aria-label="执行工作台区域" className="flex w-full gap-2">
          {[
            { id: "pipeline", label: "Pipeline 与 Canvas" },
            { id: "operations", label: "Operations" },
            { id: "run", label: "运行与交付" },
          ].map((tab) => {
            const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
              store.getState().patch({ tab: tab.id as typeof state.tab });

            return (
              <Button
                key={tab.id}
                size="sm"
                variant={state.tab === tab.id ? "secondary" : "ghost"}
                onClick={handleClick2}
              >
                {tab.label}
              </Button>
            );
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {readiness.query.error && (
          <Card className="p-4" variant="surface">
            <p className="text-sm text-destructive" role="alert">
              无法连接执行服务：{readiness.query.error.message}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              请检查 App 凭据、服务地址和 API v2 就绪状态。不会回退旧执行 API。
            </p>
          </Card>
        )}
        {state.error && (
          <Card className="p-4" variant="surface">
            <p className="whitespace-pre-wrap break-words text-sm text-destructive" role="alert">
              {state.error}
            </p>
            {/revision|conflict|409|修订/i.test(state.error) && (
              <p className="mt-2 text-sm">
                服务端修订已改变。请保留当前修改，重新加载比较后再保存；不会覆盖他人的修订。
              </p>
            )}
            <Button size="sm" variant="ghost" onClick={handleClick3}>
              关闭提示
            </Button>
          </Card>
        )}
        {busy && (
          <p className="text-sm text-muted-foreground" role="status">
            {state.pendingAction}…
          </p>
        )}
        {state.notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {state.notice}
          </p>
        )}
        {state.tab === "pipeline" ? (
          <PipelineWorkspace />
        ) : state.tab === "operations" ? (
          <OperationEditor />
        ) : (
          <RunPanel />
        )}
      </div>
    </main>
  );
};
