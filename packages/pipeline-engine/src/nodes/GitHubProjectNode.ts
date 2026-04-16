import { trace } from "@repo/obs";
import type { NodeContext, NodeResult } from "./types.js";
import type { GitHubProjectNodeData } from "../schemas/index.js";
import type { PipelineRunError } from "../errors.js";
import { cloneGitHubRepo } from "../infrastructure.js";

export const processGitHubProjectNode = async (
  ctx: NodeContext & { githubToken?: string },
): Promise<NodeResult | { ok: false; error: PipelineRunError }> => {
  const { node, deps, nodeOutputs, tempDirs, jobId, githubToken } = ctx;
  const ghData = node.data as unknown as GitHubProjectNodeData;
  const disclosureMode = ghData.disclosureMode ?? "tree";
  const excludedPaths: string[] = Array.isArray(ghData.excludedPaths) ? ghData.excludedPaths : [];

  const buildProjectContent = async (dir: string, label: string): Promise<string> => {
    const treeOpts = { excludedPaths };
    if (disclosureMode === "tree") {
      const tree = await deps.listDirTree(dir, treeOpts);
      await trace(
        jobId,
        `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile tree:\n${tree}`;
    }
    if (disclosureMode === "full") {
      const tree = await deps.listDirTree(dir, treeOpts);
      const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
      await trace(
        jobId,
        `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
      );
      return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
    }
    const fileContents = await deps.readProjectFiles(dir, { excludedPaths });
    await trace(
      jobId,
      `Disclosure mode: files-only (${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
    );
    return `${label}\n\nFile contents:\n\n${fileContents}`;
  };

  if (ghData.sourceType === "local") {
    const localPath = ghData.localPath ?? "";
    if (!localPath) {
      await trace(jobId, `WARNING: GitHub project node (local) missing localPath, skipping`);
      await trace(jobId, `@@NODE_FAIL::${node.id}`);
      nodeOutputs.set(node.id, { inputPath: "", content: "" });
      return { ok: true };
    }
    await trace(jobId, `Using local folder: ${localPath}`);
    const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
    nodeOutputs.set(node.id, { inputPath: localPath, content });
    await trace(jobId, `@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  const owner = ghData.owner;
  const repo = ghData.repo;
  const branch = ghData.branch ?? "main";

  if (!owner || !repo) {
    await trace(jobId, `WARNING: GitHub project node missing owner/repo, skipping`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);
    nodeOutputs.set(node.id, { inputPath: "", content: "" });
    return { ok: true };
  }

  await trace(jobId, `Cloning GitHub repo ${owner}/${repo}@${branch}...`);
  const cloneResult = await cloneGitHubRepo(owner, repo, branch, githubToken);
  if (cloneResult.isErr()) {
    await trace(jobId, `ERROR: ${cloneResult.error.message}`);
    await trace(jobId, `@@NODE_FAIL::${node.id}`);
    return { ok: false, error: cloneResult.error };
  }

  const clonedDir = cloneResult.value;
  tempDirs.push(clonedDir);
  const content = await buildProjectContent(
    clonedDir,
    `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
  );
  nodeOutputs.set(node.id, { inputPath: clonedDir, content });
  await trace(jobId, `@@NODE_DONE::${node.id}`);
  return { ok: true };
};
