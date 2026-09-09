import { useCustomMutation } from "@refinedev/core";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  PipelineDefinitionSchema,
  ExecutionPortValuesSchema,
  ExecutionOverridesSchema,
} from "@repo/schemas";
import { usePublishedRun } from "../../components/ExecutionRequest/usePublishedRun";
import { PublishedRunStatus } from "../../components/ExecutionRequest/PublishedRunStatus";

export const PipelineRunPanel = ({ pipelineId }: { pipelineId: string }) => {
  const { mutateAsync: publish } = useCustomMutation({ mutationOptions: { retry: false } });
  const { state, submit, handleReset, handleReceipt } = usePublishedRun(
    `pipeline-detail:${pipelineId}`,
  );
  const busy = Boolean(state.pendingAction);
  const handleRun = () =>
    void submit(async () => {
      const response = await publish({
        url: "execution/publish-canvas",
        method: "post",
        values: { pipelineId },
      });
      const pipeline = PipelineDefinitionSchema.parse(response.data.pipeline);

      return {
        pipelineId: pipeline.id,
        expectedRevision: pipeline.revision,
        inputs: ExecutionPortValuesSchema.parse(response.data.inputs),
        executionOverrides: ExecutionOverridesSchema.parse(response.data.executionOverrides ?? {}),
        deliveryRequirements: [],
      };
    });

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">
        使用画布已保存的端口绑定和输入运行。可在画布中修改输入与运行配置。
      </p>
      <Button disabled={busy || state.submission.phase !== "idle"} size="sm" onClick={handleRun}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {state.pendingAction ?? "运行"}
      </Button>
      <PublishedRunStatus
        busy={busy}
        error={state.error}
        submission={state.submission}
        onReceipt={handleReceipt}
        onReset={handleReset}
      />
    </div>
  );
};
