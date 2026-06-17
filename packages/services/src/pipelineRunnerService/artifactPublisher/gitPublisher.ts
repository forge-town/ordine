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
  isSshRepo,
  parseGitHubSlug,
  redactSecrets,
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

/**
 * github 上开 PR（base=branch||main，head=feature 分支）。
 * - { url } 成功；{ error } API 失败（区分于"未开 PR"，避免误报成功）；
 * - null 表示无法开 PR（非 github / 无 token）。
 */
type PrResult = { url: string } | { error: string } | null;

const createPr = async (opts: PublishArtifactOptions, head: string): Promise<PrResult> => {
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
  if (!res.ok) return { error: `GitHub PR API ${res.status}` };
  const data = (await res.json()) as { html_url?: string };

  return data.html_url ? { url: data.html_url } : { error: "GitHub PR API returned no url" };
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

  const compare = buildCompareUrl(opts.repo, branch);
  const pushedHint = compare
    ? `Pushed ${branch} — open PR: ${compare}`
    : `Pushed ${branch} to ${opts.repo}`;

  if (opts.openPr !== false) {
    const pr = await createPr(opts, branch);
    if (pr && "url" in pr) return `PR opened: ${pr.url}`;
    if (pr && "error" in pr) {
      // PR 开失败（分支已推成功）：不静默——告警并明确告知手动开。
      await opts.onProgress?.(`WARNING: PR not opened (${pr.error}) — push succeeded`);

      return `${pushedHint} (PR auto-open failed: ${pr.error})`;
    }
  }

  return pushedHint;
};

const runGitPublish = async (opts: PublishArtifactOptions): Promise<string> => {
  // 凭证缺失对外不可逆操作不能静默：直接失败（waiting+修复链接流为遗留）。
  // SSH 远端自带密钥凭证，不需要 token。
  if (isGitHubRepo(opts.repo) && !isSshRepo(opts.repo) && !opts.githubToken) {
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
      : // 关键：git 命令失败时 error.message 含带 token 的 clone URL，落库前必须脱敏。
        new GitPublishError(`git publish failed: ${redactSecrets((error as Error).message)}`),
  );
