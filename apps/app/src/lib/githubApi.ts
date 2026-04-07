const GITHUB_API_BASE = "https://api.github.com";

export type GitHubTokenStatus = { valid: true; login: string } | { valid: false; error: string };

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
  defaultBranch: string;
  description: string;
  isPrivate: boolean;
  fullName: string;
}

export const getGitHubHeaders = (token?: string | null): HeadersInit => {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const verifyGitHubToken = async (token: string | null): Promise<GitHubTokenStatus> => {
  if (!token?.trim()) {
    return { valid: false, error: "TOKEN_EMPTY:Token 不能为空" };
  }

  try {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    });

    if (res.ok) {
      const data = await res.json();
      return { valid: true, login: data.login as string };
    }

    if (res.status === 401) {
      return {
        valid: false,
        error: "AUTH_FAILED:Token 无效或已过期，请重新配置",
      };
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as { message?: string }).message ?? "";
      if (msg.toLowerCase().includes("rate limit")) {
        return {
          valid: false,
          error: "RATE_LIMIT:GitHub API 已达到限流，请稍后再试",
        };
      }
      return { valid: false, error: "AUTH_FAILED:Token 权限不足或被禁用" };
    }

    return {
      valid: false,
      error: `AUTH_FAILED:验证失败 (状态码: ${res.status})`,
    };
  } catch {
    return { valid: false, error: "NETWORK_ERROR:网络错误，无法验证 Token" };
  }
};

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
}

export const parseGitHubUrl = (url: string): ParsedGitHubUrl | null => {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com") return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;

    const [owner, repo, treeKeyword, ...branchParts] = parts;
    if (!owner || !repo) return null;

    const branch =
      treeKeyword === "tree" && branchParts.length > 0 ? branchParts.join("/") : undefined;

    return { owner, repo, branch };
  } catch {
    return null;
  }
};

export const fetchRepoInfo = async (
  owner: string,
  repo: string,
  token?: string | null,
  branchHint?: string
): Promise<GitHubRepoInfo> => {
  const headers = getGitHubHeaders(token);

  const repoRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers,
  });

  if (!repoRes.ok) {
    if (repoRes.status === 404) {
      throw new Error(
        token
          ? "仓库不存在，请检查 owner/repo 是否正确"
          : "仓库不存在或为私有仓库，请先配置 GitHub Token"
      );
    }
    if (repoRes.status === 401 || repoRes.status === 403) {
      throw new Error("无权访问该仓库，请检查 Token 是否有效");
    }
    throw new Error(`获取仓库信息失败 (${repoRes.status})`);
  }

  const repoData = await repoRes.json();
  const defaultBranch = (repoData as { default_branch: string }).default_branch;
  const targetBranch = branchHint ?? defaultBranch;

  return {
    owner,
    repo,
    branch: targetBranch,
    defaultBranch,
    description: (repoData as { description?: string }).description ?? "",
    isPrivate: (repoData as { private: boolean }).private,
    fullName: (repoData as { full_name: string }).full_name,
  };
};
