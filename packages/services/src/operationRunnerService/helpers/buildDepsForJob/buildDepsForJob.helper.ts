import type { AgentRuntime, SshConnection } from "@repo/schemas";

import { loopEvaluator } from "../../../pipelineRunnerService/helpers/loopEvaluator";
import { pipelineRunnerEngineDeps } from "../../../pipelineRunnerService/helpers/engineDeps";

export const createBuildDepsForJobHelper =
  () =>
  ({
    jobId,
    apiKey,
    model,
    defaultAgent,
    ssh,
  }: {
    jobId: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
    ssh?: SshConnection;
  }) => {
    const evaluateLoopCondition = loopEvaluator.create({ apiKey })({ jobId });

    return pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId,
      apiKey,
      model,
      defaultAgent,
      ssh,
    });
  };
