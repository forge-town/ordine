import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "./types";
import type { NodeData } from "../schemas";

export const processCodeFileNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;
  const data = node.data as unknown as NodeData;
  const p = data.filePath ?? "";

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
