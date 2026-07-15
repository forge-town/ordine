import { trace } from "@repo/obs";
import { encodeNodeDone, encodeNodeFail } from "@repo/schemas";
import { listDirTree, readProjectFiles } from "@repo/utils";
import type { NodeContext, NodeResult } from "../types";
import { cloneGitHubRepo } from "../../infrastructure";

export const processGitHubProjectNode = async (
  ctx: NodeContext & { githubToken?: string },
): Promise<NodeResult> => {
  const { node, nodeOutputs, tempDirs, jobId, githubToken } = ctx;

  if (node.data.nodeType !== "github-project") {
    await trace(
      jobId,
      `WARNING: Expected github-project node, got ${node.data.nodeType ?? "unknown"}`,
    );
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  const ghData = node.data;
  const disclosureMode = ghData.disclosureMode ?? "tree";
  const excludedPaths: string[] = Array.isArray(ghData.excludedPaths) ? ghData.excludedPaths : [];

  const buildProjectContent = async (dir: string, label: string): Promise<string> => {
    const treeOpts = { excludedPaths };
    if (disclosureMode === "tree") {
      const tree = await listDirTree(dir, treeOpts);
      await trace(
        jobId,
        `Disclosure mode: tree (${tree.split("\n").length} entries, excluded: [${excludedPaths.join(", ")}])`,
      );

      return `${label}\n\nFile tree:\n${tree}`;
    }
    if (disclosureMode === "full") {
      const tree = await listDirTree(dir, treeOpts);
      const fileContents = await readProjectFiles(dir, { excludedPaths });
      await trace(
        jobId,
        `Disclosure mode: full (tree + file contents, ${fileContents.length} chars, excluded: [${excludedPaths.join(", ")}])`,
      );

      return `${label}\n\nFile tree:\n${tree}\n\n---\n\nFile contents:\n\n${fileContents}`;
    }
    const fileContents = await readProjectFiles(dir, { excludedPaths });
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
      await trace(jobId, encodeNodeFail(node.id));

      return { outcome: "soft-failed" };
    }
    await trace(jobId, `Using local folder: ${localPath}`);
    const content = await buildProjectContent(localPath, `Local Folder: ${localPath}`);
    nodeOutputs.set(node.id, { inputPath: localPath, content });
    await trace(jobId, encodeNodeDone(node.id));

    return { outcome: "completed" };
  }

  const owner = ghData.owner;
  const repo = ghData.repo;
  const branch = ghData.branch ?? "main";

  if (!owner || !repo) {
    await trace(jobId, `WARNING: GitHub project node missing owner/repo, skipping`);
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "soft-failed" };
  }

  const accessMode = ghData.accessMode ?? "clone";

  if (accessMode === "remote") {
    await trace(
      jobId,
      `Remote mode: providing GitHub repo context for ${owner}/${repo}@${branch} (agent will use gh CLI)`,
    );
    const content = `GitHub Repository: ${owner}/${repo} (branch: ${branch})\n\nThis repository is accessed remotely. Use \`gh\` CLI commands to browse files, e.g.:\n- \`gh api repos/${owner}/${repo}/git/trees/${branch} --jq '.tree[].path'\` to list top-level files\n- \`gh api repos/${owner}/${repo}/contents/{path}?ref=${branch}\` to read file metadata\n- \`gh api repos/${owner}/${repo}/contents/{path}?ref=${branch} -H 'Accept: application/vnd.github.raw+json'\` to read file content`;
    nodeOutputs.set(node.id, {
      inputPath: `https://github.com/${owner}/${repo}`,
      content,
      githubRemote: { owner, repo, branch },
    });
    await trace(jobId, encodeNodeDone(node.id));

    return { outcome: "completed" };
  }

  await trace(jobId, `Cloning GitHub repo ${owner}/${repo}@${branch}...`);
  const cloneResult = await cloneGitHubRepo(owner, repo, branch, githubToken);
  if (cloneResult.isErr()) {
    await trace(jobId, `ERROR: ${cloneResult.error.message}`);
    await trace(jobId, encodeNodeFail(node.id));

    return { outcome: "failed", error: cloneResult.error };
  }

  const clonedDir = cloneResult.value;
  tempDirs.push(clonedDir);
  const content = await buildProjectContent(
    clonedDir,
    `Repository: ${owner}/${repo} (branch: ${branch})\nPath: ${clonedDir}`,
  );
  nodeOutputs.set(node.id, { inputPath: clonedDir, content });
  await trace(jobId, encodeNodeDone(node.id));

  return { outcome: "completed" };
};
