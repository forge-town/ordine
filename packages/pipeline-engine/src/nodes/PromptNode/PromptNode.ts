import { trace } from "@repo/obs";
import { encodeNodeDone, encodeNodeFail } from "@repo/schemas";
import type { NodeContext, NodeResult } from "../types";

export const processPromptNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "prompt") {
    await trace(jobId, `WARNING: Expected prompt node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  const prompt = node.data.prompt ?? "";
  nodeOutputs.set(node.id, { inputPath: "", content: prompt });
  await trace(jobId, `Prompt node: "${node.data.label}" (${prompt.length} chars)`);
  await trace(jobId, encodeNodeDone(node.id));

  return { outcome: "completed" };
};
