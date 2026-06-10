import type { NodeRunStatus } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";

export type StepBarStatus = NodeRunStatus | "unknown";

export type StepBarStep = {
  id: string;
  status: StepBarStatus;
};

export type StepBarProps = {
  steps: StepBarStep[];
};

const ACTIVE_STATUSES = new Set<StepBarStatus>(["queued", "running", "retrying", "waitingForUser"]);
const COMPLETE_STATUSES = new Set<StepBarStatus>(["done", "skipped"]);

const getStepClassName = (status: StepBarStatus) => {
  if (COMPLETE_STATUSES.has(status)) return "bg-foreground/70";
  if (status === "failed" || status === "cancelled") return "bg-destructive/70";
  if (ACTIVE_STATUSES.has(status)) return "bg-foreground/40 edge-flow";

  return "bg-surface-3";
};

export const StepBar = ({ steps }: StepBarProps) => {
  const safeSteps = steps.length > 0 ? steps : [{ id: "empty", status: "unknown" as const }];

  return (
    <div aria-label="Job step progress" className="flex items-center gap-1.5">
      {safeSteps.map((step) => (
        <span
          key={step.id}
          className={cn("h-1.5 w-5 rounded-full", getStepClassName(step.status))}
          title={`${step.id}: ${step.status}`}
        />
      ))}
    </div>
  );
};
