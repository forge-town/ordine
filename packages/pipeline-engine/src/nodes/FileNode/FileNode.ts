import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { trace } from "@repo/obs";
import { encodeNodeDone, encodeNodeFail } from "@repo/schemas";
import type { NodeContext, NodeResult } from "../types";

export const processFileNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "file") {
    await trace(jobId, `WARNING: Expected file node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, encodeNodeFail(node.id));

    return { ok: false, error: null };
  }

  const p = node.data.filePath;

  if (p && existsSync(p)) {
    const content = await readFile(p, "utf8");
    nodeOutputs.set(node.id, { inputPath: p, content });
    await trace(jobId, `Read code file: ${p} (${content.length} chars)`);
  } else {
    nodeOutputs.set(node.id, { inputPath: p ?? "", content: "" });
  }

  await trace(jobId, encodeNodeDone(node.id));

  return { ok: true };
};
