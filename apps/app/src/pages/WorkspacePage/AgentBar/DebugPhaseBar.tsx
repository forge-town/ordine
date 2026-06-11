import type { WorkspacePhase } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { useWorkspaceStore } from "../_store/workspaceStore";

export const WORKSPACE_PHASES: WorkspacePhase[] = [
  "empty",
  "reversing",
  "clarify",
  "proposal",
  "applied",
  "running",
  "done",
];

export const isPhaseDebugEnabled = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("debug") === "phases";

/**
 * Dev-only phase switcher. Hidden unless the URL carries `?debug=phases` —
 * phase is otherwise exclusively derived (see WorkspacePhaseSync).
 */
export const DebugPhaseBar = () => {
  const phase = useWorkspaceStore((state) => state.phase);
  const setPhase = useWorkspaceStore((state) => state.setPhase);

  if (!isPhaseDebugEnabled()) {
    return null;
  }

  return (
    <div
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 px-3 py-2"
      data-testid="agent-debug-phase-bar"
    >
      {WORKSPACE_PHASES.map((targetPhase) => (
        <Button
          key={targetPhase}
          className="h-7 shrink-0 rounded-full px-2 text-[10.5px]"
          size="sm"
          variant={targetPhase === phase ? "secondary" : "ghost"}
          onClick={() => setPhase(targetPhase)}
        >
          {targetPhase}
        </Button>
      ))}
    </div>
  );
};
