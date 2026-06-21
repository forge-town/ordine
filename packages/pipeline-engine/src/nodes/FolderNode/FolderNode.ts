import { existsSync } from "node:fs";
import { trace } from "@repo/obs";
import { listDirTree, readProjectFiles } from "@repo/utils";
import type { NodeContext, NodeResult } from "../types";

export const processFolderNode = async (ctx: NodeContext): Promise<NodeResult> => {
  const { node, nodeOutputs, jobId } = ctx;

  if (node.data.nodeType !== "folder") {
    await trace(jobId, `WARNING: Expected folder node, got ${node.data.nodeType ?? "unknown"}`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);

    return { ok: false, error: null };
  }

  const p = node.data.folderPath ?? "";
  const excludedPaths = node.data.excludedPaths ?? [];
  const includedExtensions = node.data.includedExtensions;
  const disclosureMode = node.data.disclosureMode ?? "tree";

  if (p && existsSync(p)) {
    const tree = await listDirTree(p, { excludedPaths });
    const readOpts = { excludedPaths, includedExtensions };
    const content = await (async () => {
      if (disclosureMode === "full") {
        const fileContents = await readProjectFiles(p, readOpts);
        await trace(
          jobId,
          `Input folder: ${p} (disclosure: full, tree: ${tree.split("\n").length} entries, contents: ${fileContents.length} chars)`,
        );

        return `Folder: ${p}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
      }
      if (disclosureMode === "files-only") {
        const fileContents = await readProjectFiles(p, readOpts);
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
