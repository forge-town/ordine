import { Bot, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@repo/ui/button";
import { CanvasPageContent } from "@/pages/CanvasPage/CanvasPageContent";
import { CanvasPageStoreProvider } from "@/pages/CanvasPage/_store";
import { Icon, StatusPill, Tag } from "@/components/primitives";
import { useWorkspaceStore } from "./_store/workspaceStore";

export type WorkspacePageProps = {
  pipelineId: string;
};

const phaseLabel = {
  empty: "Empty",
  clarify: "Clarify",
  proposal: "Proposal",
  applied: "Applied",
  running: "Running",
  done: "Done",
};

export const WorkspacePage = ({ pipelineId }: WorkspacePageProps) => {
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const canvasRefs = useWorkspaceStore((state) => state.canvasRefs);
  const phase = useWorkspaceStore((state) => state.phase);
  const toggleAgentOpen = useWorkspaceStore((state) => state.toggleAgentOpen);
  const handleAgentBarToggle = () => {
    toggleAgentOpen();
  };

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <main className="min-w-0 flex-1 overflow-hidden">
        <CanvasPageStoreProvider
          pipeline={{ edges: [], id: pipelineId, name: `Pipeline ${pipelineId}`, nodes: [] }}
        >
          <CanvasPageContent />
        </CanvasPageStoreProvider>
      </main>

      {agentOpen ? (
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2">
              <Icon className="text-muted-foreground" icon={Bot} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-tight">Agent Bar</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <StatusPill
                  status={phase === "done" ? "done" : phase === "running" ? "running" : "idle"}
                />
                <span className="text-[10.5px] text-muted-foreground">{phaseLabel[phase]}</span>
              </div>
            </div>
            <Button
              aria-label="Collapse Agent Bar"
              className="h-8 w-8"
              size="icon"
              variant="ghost"
              onClick={handleAgentBarToggle}
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-between p-4">
            <div className="space-y-3">
              <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                <div className="text-[12.5px] font-medium">Workspace context</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag>{pipelineId}</Tag>
                  <Tag>{phase}</Tag>
                  {canvasRefs.map((ref) => (
                    <Tag key={ref.id}>{ref.label}</Tag>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-background p-3 text-[12.5px] text-muted-foreground ring-1 ring-border">
                Standing by for workspace context.
              </div>
            </div>

            <div className="rounded-xl bg-background px-3 py-2 text-[12px] text-muted-foreground ring-1 ring-border">
              Composer placeholder
            </div>
          </div>
        </aside>
      ) : (
        <button
          aria-label="Open Agent Bar"
          className="flex w-12 shrink-0 items-center justify-center border-l border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
          type="button"
          onClick={handleAgentBarToggle}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
