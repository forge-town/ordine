import type { NodeContext, NodeResult } from "./types.js";
import type { GitHubProjectNodeData } from "../schemas/index.js";
import type { PipelineRunError } from "../errors.js";
import { cloneGitHubRepo } from "../infrastructure.js";

export const processGitHubProjectNode = async (
  ctx: NodeContext & { githubToken?: string },
): Promise<NodeResult | { ok: false; error: PipelineRunError }> => {
  const { node, deps, nodeOutputs, tempDirs, githubToken } = ctx;
  const { log } = deps;
  const ghData = node.data as unknown as GitHubProjectNodeData;
  const disclosureMode = ghData.disclosureMode ?? "tree";
  const excludedPaths: string[] = Array.isArray(ghData.excludedPaths) ? ghData.excludedPaths : [];

  const buildProjectContent = async (dir: string, label: string): Promise<string> => {
    const treeOpts = { excludedPaths };
    if (disclosureMode === "tree") {
      const tree = await deps.listDirTree(dir, treeOpts);
      await log(
        `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile tree:\n${tree}`;
    }
    if (disclosureMode === "full") {
      const tree = await deps.listDirTree(dir, treeOpts);
      const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
      await log(
        `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
    }
    const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
    await log(
      `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
    );
    return `${label}\n\nFile contents:\n\n${fileContents}`;
  };

  if (ghData.sourceType === "local") {
    const localPath = ghData.localPath ?? "";
    if (!localPath) {
      await log(`WARNING: GitHub project node (local) missing localPath, skipping`);
      await log(`@@NODE_FAIL::${node.id}`);
      nodeOutputs.set(node.id, { inputPath: "", content: "" });
      return { ok: true };
    }
    await log(`Using local folder: ${localPath}`);
    const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
    nodeOutputs.set(node.id, { inputPath: localPath, content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  const owner = ghData.owner;
  const repo = ghData.repo;
  const branch = ghData.branch ?? "main";

  if (!owner || !repo) {
    await log(`WARNING: GitHub project node missing owner/repo, skipping`);
    await log(`@@NODE_FAIL::${node.id}`);
    nodeOutputs.set(node.id, { inputPath: "", content: "" });
    return { ok: true };
  }

  await log(`Cloning GitHub repo ${owner}/${repo}@${branch}...`);
  const cloneResult = await cloneGitHubRepo(owner, repo, branch, githubToken);
  if (cloneResult.isErr()) {
    await log(`ERROR: ${cloneResult.error.message}`);
    await log(`@@NODE_FAIL::${node.id}`);
    return { ok: false, error: cloneResult.error };
  }

  const clonedDir = cloneResult.value;
  tempDirs.push(clonedDir);
  const content = await buildProjectContent(
    clonedDir,
    `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
  );
  nodeOutputs.set(node.id, { inputPath: clonedDir, content });
  await log(`@@NODE_DONE::${node.id}`);
  return { ok: true };
};
