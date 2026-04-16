import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { NodeContext, NodeResult } from "./types.js";
import type { NodeData } from "../schemas/index.js";

export const processCodeFileNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, deps, nodeOutputs } = ctx;
  const { log } = deps;
  const data = node.data as unknown as NodeData;
  const p = data.filePath ?? "";

  if (p && existsSync(p)) {
    const content = await readFile(p, "utf8");
    nodeOutputs.set(node.id, { inputPath: p, content });
    await log(`Read code file: ${p} (${content.length} chars)`);
  } else {
    nodeOutputs.set(node.id, { inputPath: p, content: "" });
  }
  await log(`@@NODE_DONE::${node.id}`);

  return { ok: true };
};
