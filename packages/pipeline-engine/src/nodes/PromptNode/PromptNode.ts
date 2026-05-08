import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "../types";

export const processPromptNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "prompt") {
    await trace(jobId, `WARNING: Expected prompt node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const prompt = node.data.prompt ?? "";
  nodeOutputs.set(node.id, { inputPath: "", content: prompt });
  await trace(jobId, `Prompt node: "${node.data.label}" (${prompt.length} chars)`);
  await trace(jobId, `@@NODE_DONE::${node.id}`);

  return { ok: true };
};
