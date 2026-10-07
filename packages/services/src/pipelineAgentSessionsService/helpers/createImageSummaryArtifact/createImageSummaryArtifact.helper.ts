import type {
  AgentRuntime,
  PipelineAgentContextArtifactContent,
  PipelineAgentContextArtifactKind,
} from "@repo/schemas";

import { runAgent } from "../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createCreateImageSummaryArtifactHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) =>
  async (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    runtime: AgentRuntime;
    apiKey?: string;
    model?: string;
  }): Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }> => {
    const summary = await runAgent({
      agent: input.runtime,
      systemPrompt:
        "Describe the uploaded image for workflow planning. Return a concise text summary.",
      userPrompt: "Summarize visible text, objects, structure, and workflow-relevant clues.",
      inputPath: process.cwd(),
      agentId: "pipeline-agent-image-summary",
      logPrefix: "pipelineAgentImage",
      apiKey: input.apiKey,
      model: input.model,
      attachments: [
        {
          kind: "image",
          filename: input.filename,
          mediaType: input.mimeType,
          dataBase64: Buffer.from(input.bytes).toString("base64"),
        },
      ],
    });

    return {
      kind: "image_summary",
      content: {
        mediaType: input.mimeType,
        summary,
        metadata: {
          filename: input.filename,
          sizeBytes: input.bytes.byteLength,
        },
      },
    };
  };
