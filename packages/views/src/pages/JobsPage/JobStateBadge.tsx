import type { ExecutionJobState } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { jobLabels } from "../ExecutionWorkspacePage/useJobData";

export const JobStateBadge = ({ state }: { state: ExecutionJobState }) => (
  <Badge
    title={state}
    variant={["failed", "timed_out", "interrupted"].includes(state) ? "destructive" : "secondary"}
  >
    {jobLabels[state] ?? state}
  </Badge>
);
