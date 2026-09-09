import { useList } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { ExecutionJob } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { JobDetails } from "./JobDetails";
import { jobLabels } from "./useJobData";
export const JobPanel = () => {
  const { state, store } = useWorkspaceData();
  const { result, query } = useList<ExecutionJob>({
    resource: "jobs",
    meta: { selectedJobId: state.selectedJobId },
    pagination: { mode: "off" },
    queryOptions: { retry: false },
  });
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void query.refetch();

  return (
    <div className="space-y-5">
      <Card className="p-4" variant="surface">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Jobs</h2>
          <Button size="sm" variant="ghost" onClick={handleClick1}>
            刷新列表
          </Button>
        </div>
        {query.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {query.error.message}
          </p>
        )}
        {result.data.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            尚无 Job；等待审批的请求不会伪装成 Job。
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {result.data.slice(0, 20).map((job) => {
            const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
              store.getState().patch({ selectedJobId: job.id });

            return (
              <Button
                key={job.id}
                size="sm"
                variant={job.id === state.selectedJobId ? "secondary" : "outline"}
                onClick={handleClick2}
              >
                {job.id.slice(0, 16)}… · {jobLabels[job.state]}
              </Button>
            );
          })}
        </div>
      </Card>
      {state.selectedJobId && <JobDetails key={state.selectedJobId} />}
    </div>
  );
};
