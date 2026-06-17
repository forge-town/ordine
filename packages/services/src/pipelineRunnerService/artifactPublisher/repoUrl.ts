/** owner/repo 简写（无协议、单斜杠）。 */
const OWNER_REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export const isOwnerRepo = (repo: string): boolean => OWNER_REPO_RE.test(repo);

export const isGitHubRepo = (repo: string): boolean =>
  isOwnerRepo(repo) || repo.includes("github.com");

/** owner/repo → {owner, repo}；完整 github URL 亦解析。null 表示非 github。 */
export const parseGitHubSlug = (repo: string): { owner: string; repo: string } | null => {
  if (isOwnerRepo(repo)) {
    const [owner, name] = repo.split("/");

    return { owner: owner!, repo: name!.replace(/\.git$/, "") };
  }
  const match = repo.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);

  return match ? { owner: match[1]!, repo: match[2]! } : null;
};

/**
 * 解析 clone URL，必要时注入 x-access-token（仅 github https/owner-repo）。
 * file://、git@、非 github https 原样返回（本地/SSH 自带凭证）。
 */
export const resolveCloneUrl = (repo: string, token?: string): string => {
  const slug = parseGitHubSlug(repo);
  if (slug) {
    const auth = token ? `x-access-token:${token}@` : "";

    return `https://${auth}github.com/${slug.owner}/${slug.repo}.git`;
  }

  return repo;
};

/** github 上的 compare/PR 创建链接（供未开 PR 时返回给用户手动开）。 */
export const buildCompareUrl = (repo: string, branch: string): string | null => {
  const slug = parseGitHubSlug(repo);

  return slug ? `https://github.com/${slug.owner}/${slug.repo}/compare/${branch}?expand=1` : null;
};

export const featureBranchName = (jobId?: string): string =>
  `ordine/publish-${(jobId ?? "manual").slice(0, 8)}`;
