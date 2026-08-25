import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import type { AgentApproval } from "@repo/schemas";
import { useAgentControl } from "./GlobalAgentControlProvider";

export const AgentApprovalCard = ({ approval }: { approval: AgentApproval }) => {
  const approve = useAgentControl((state) => state.approve);
  const reject = useAgentControl((state) => state.rejectApproval);

  return (
    <article
      className="rounded-xl border border-warning/35 bg-warning/5 p-3"
      data-testid="agent-approval-card"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Confirmation required</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {approval.toolName}
            {approval.target ? ` · ${approval.target.label ?? approval.target.id}` : ""}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            One-time approval expires {new Date(approval.expiresAt).toLocaleTimeString()}.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void approve(approval.id)}>
              <Check /> Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => void reject(approval.id)}>
              <X /> Reject
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};
