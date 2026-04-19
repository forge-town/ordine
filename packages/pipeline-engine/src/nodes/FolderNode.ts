import { existsSync } from "node:fs";
import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "./types";
import type { NodeData } from "../schemas";

export const processFolderNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, deps, nodeOutputs, jobId } = ctx;
  const data = node.data as unknown as NodeData;
  const p = data.folderPath ?? "";
  const excludedPaths: string[] = Array.isArray(data.excludedPaths) ? data.excludedPaths : [];
  const includedExtensions: string[] | undefined = Array.isArray(data.includedExtensions)
    ? data.includedExtensions
    : undefined;
  const disclosureMode = data.disclosureMode ?? "tree";

  if (p && existsSync(p)) {
    const tree = await deps.listDirTree(p, { excludedPaths });
    const readOpts = { excludedPaths, includedExtensions };
    const content = await (async () => {
      if (disclosureMode === "full") {
        const fileContents = await deps.readProjectFiles(p, readOpts);
        await trace(
          jobId,
          `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`,
        );

        return `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
      }
      if (disclosureMode === "files-only") {
        const fileContents = await deps.readProjectFiles(p, readOpts);
        await trace(
          jobId,
          `Input folder: ${p} (disclosure: files-only, ${fileContents.length} chars)`,
        );

        return `Folder: ${p}\n\nFile contents:\n\n${fileContents}`;
      }
      await trace(jobId, `Input folder: ${p} (tree: ${tree.split("\n").length} entries)`);

      return `Folder: ${p}\n\nFile tree:\n${tree}`;
    })();
    nodeOutputs.set(node.id, { inputPath: p, content });
  } else {
    nodeOutputs.set(node.id, { inputPath: p, content: "" });
  }
  await trace(jobId, `@@NODE_DONE::${node.id}`);

  return { ok: true };
};
