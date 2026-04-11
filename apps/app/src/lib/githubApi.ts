import { Result, ResultAsync, errAsync } from "neverthrow";

const GITHUB_API_BASE = "https://api.github.com";

export type GitHubTokenStatus =
  | { valid: true; login: string }
  | { valid: false; error: string };

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

export const verifyGitHubToken = async (
  token: string | null,
): Promise<GitHubTokenStatus> => {
  if (!token?.trim()) {
    return { valid: false, error: "TOKEN_EMPTY:Token 不能为空" };
  }

  const result = await ResultAsync.fromPromise(
    fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    }),
    () => "NETWORK_ERROR:网络错误，无法验证 Token",
  );

  if (result.isErr()) {
    return { valid: false, error: result.error };
  }

  const res = result.value;

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
    const jsonResult = await ResultAsync.fromPromise(
      res.json() as Promise<Record<string, unknown>>,
      () => ({}),
    );
    const data = jsonResult.unwrapOr({});
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
};

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
}

export const parseGitHubUrl = (url: string): ParsedGitHubUrl | null => {
  const urlResult = Result.fromThrowable(
    () => new URL(url.trim()),
    () => null,
  )();
  if (urlResult.isErr()) return null;

  const parsed = urlResult.value;
  if (parsed.hostname !== "github.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo, treeKeyword, ...branchParts] = parts;
  if (!owner || !repo) return null;

  const branch =
    treeKeyword === "tree" && branchParts.length > 0
      ? branchParts.join("/")
      : undefined;

  return { owner, repo, branch };
};

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export const fetchRepoInfo = (
  owner: string,
  repo: string,
  token?: string | null,
  branchHint?: string,
): ResultAsync<GitHubRepoInfo, string> => {
  const headers = getGitHubHeaders(token);

  return ResultAsync.fromPromise(
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers }),
    () => "网络错误，无法连接 GitHub",
  ).andThen((repoRes) => {
    if (repoRes.ok) {
      return ResultAsync.fromPromise(
        repoRes.json() as Promise<Record<string, unknown>>,
        () => "解析仓库数据失败",
      ).map((repoData) => {
        const defaultBranch = repoData.default_branch as string;
        const targetBranch = branchHint ?? defaultBranch;
        return {
          owner,
          repo,
          branch: targetBranch,
          defaultBranch,
          description: (repoData.description as string) ?? "",
          isPrivate: repoData.private as boolean,
          fullName: repoData.full_name as string,
        };
      });
    }

    if (repoRes.status === 404) {
      return errAsync(
        token
          ? "仓库不存在，请检查 owner/repo 是否正确"
          : "仓库不存在或为私有仓库，请先配置 GitHub Token",
      );
    }

    if (repoRes.status === 401 || repoRes.status === 403) {
      return errAsync("无权访问该仓库，请检查 Token 是否有效");
    }

    return errAsync(`获取仓库信息失败 (${repoRes.status})`);
  });
};
