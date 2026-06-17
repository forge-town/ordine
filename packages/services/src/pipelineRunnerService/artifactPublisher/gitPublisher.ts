import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import { GitPublishError, type PublishArtifactOptions } from "@repo/pipeline-engine";
import {
  buildCompareUrl,
  featureBranchName,
  isGitHubRepo,
  parseGitHubSlug,
  resolveCloneUrl,
} from "./repoUrl";

const GIT_OPTS = {
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  timeout: 120_000,
  encoding: "utf8" as const,
};
const COMMIT_AUTHOR = [
  "-c",
  "user.name=Ordine",
  "-c",
  "user.email=ordine@users.noreply.github.com",
];

const git = (args: string[], cwd?: string): string =>
  execFileSync("git", args, { ...GIT_OPTS, cwd })
    .toString()
    .trim();

/** github 上开 PR（base=branch||main，head=feature 分支）；失败/非 github 返回 null。 */
const createPr = async (opts: PublishArtifactOptions, head: string): Promise<string | null> => {
  const slug = parseGitHubSlug(opts.repo);
  if (!slug || !opts.githubToken) return null;
  const res = await fetch(`https://api.github.com/repos/${slug.owner}/${slug.repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: opts.commitMessage ?? "Ordine publish",
      head,
      base: opts.branch ?? "main",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { html_url?: string };

  return data.html_url ?? null;
};

const publishIntoCheckout = async (
  checkout: string,
  opts: PublishArtifactOptions,
): Promise<string> => {
  const cloneArgs = ["clone", "--depth", "1"];
  if (opts.branch) cloneArgs.push("--branch", opts.branch);
  cloneArgs.push(resolveCloneUrl(opts.repo, opts.githubToken), checkout);
  git(cloneArgs);

  // 永不直推默认/基分支：所有改动落到新建的 feature 分支。
  const branch = featureBranchName(opts.jobId);
  git(["checkout", "-b", branch], checkout);

  const target = opts.subPath ? join(checkout, opts.subPath) : checkout;
  await mkdir(target, { recursive: true });
  await cp(opts.sourceDir, target, { recursive: true });

  git(["add", "-A"], checkout);
  if (!git(["status", "--porcelain"], checkout)) {
    throw new GitPublishError("nothing to publish (source produced no changes)");
  }
  git([...COMMIT_AUTHOR, "commit", "-m", opts.commitMessage ?? "Ordine publish"], checkout);
  await opts.onProgress?.(`Committed to ${branch}`);
  git(["push", "origin", branch], checkout);

  if (opts.openPr !== false) {
    const prUrl = await createPr(opts, branch);
    if (prUrl) return `PR opened: ${prUrl}`;
  }
  const compare = buildCompareUrl(opts.repo, branch);

  return compare ? `Pushed ${branch} — open PR: ${compare}` : `Pushed ${branch} to ${opts.repo}`;
};

const runGitPublish = async (opts: PublishArtifactOptions): Promise<string> => {
  // 凭证缺失对外不可逆操作不能静默：直接失败（waiting+修复链接流为遗留）。
  if (isGitHubRepo(opts.repo) && !opts.githubToken) {
    throw new GitPublishError("missing GitHub credential — connect GitHub before publishing");
  }
  const checkout = await mkdtemp(join(tmpdir(), "ordine-publish-"));
  // 不用 try/finally（no-try 规则）：用 then 捕获结果，清理临时目录后再决定抛/返。
  const outcome = await publishIntoCheckout(checkout, opts).then(
    (value) => ({ value, error: null as Error | null }),
    (error: unknown) => ({ value: "", error: error as Error }),
  );
  await rm(checkout, { recursive: true, force: true });
  if (outcome.error) throw outcome.error;

  return outcome.value;
};

export const gitPublish = (opts: PublishArtifactOptions): ResultAsync<string, GitPublishError> =>
  ResultAsync.fromPromise(runGitPublish(opts), (error) =>
    error instanceof GitPublishError
      ? error
      : new GitPublishError(`git publish failed: ${(error as Error).message}`, error),
  );
