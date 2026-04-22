import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "../types";

export const processCodeFileNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "code-file") {
    await trace(jobId, `WARNING: Expected code-file node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const p = node.data.filePath ?? "";

  if (p && existsSync(p)) {
    const content = await readFile(p, "utf8");
    nodeOutputs.set(node.id, { inputPath: p, content });
    await trace(jobId, `Read code file: ${p} (${content.length} chars)`);
  } else {
    nodeOutputs.set(node.id, { inputPath: p, content: "" });
  }
  await trace(jobId, `@@NODE_DONE::${node.id}`);

  return { ok: true };
};
