import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createBuildArtifactSummaryHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "contextArtifactsDao">) =>
  (
    artifacts: Awaited<ReturnType<typeof serviceBindings.contextArtifactsDao.findManyBySessionId>>,
  ) =>
    artifacts.length === 0
      ? "(none)"
      : artifacts
          .map((artifact) => {
            const summary =
              typeof artifact.content.summary === "string" &&
              artifact.content.summary.trim().length > 0
                ? artifact.content.summary
                : JSON.stringify(artifact.content);

            return `- ${artifact.kind}: ${summary}`;
          })
          .join("\n");
