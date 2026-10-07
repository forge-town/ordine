import type {
  PipelineAgentContextArtifactContent,
  PipelineAgentContextArtifactKind,
} from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createSaveContextArtifactMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "contextArtifactsDao">) =>
  async (
    sessionId: string,
    input: {
      attachmentId?: string | null;
      kind: PipelineAgentContextArtifactKind;
      content: PipelineAgentContextArtifactContent;
    },
  ) => {
    return serviceBindings.contextArtifactsDao.create({
      id: crypto.randomUUID(),
      sessionId,
      attachmentId: input.attachmentId ?? null,
      kind: input.kind,
      content: input.content,
    });
  };
