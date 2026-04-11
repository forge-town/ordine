import { Result, ResultAsync, errAsync } from "neverthrow";
import i18n from "@/lib/i18n";

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
  const t = i18n.t.bind(i18n);
  
  if (!token?.trim()) {
    return { valid: false, error: `TOKEN_EMPTY:${t("github.tokenEmpty")}` };
  }

  const result = await ResultAsync.fromPromise(
    fetch(`${GITHUB_API_BASE}/user`, {
      headers: getGitHubHeaders(token),
    }),
    () => `NETWORK_ERROR:${t("github.networkError")}`
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
      error: `AUTH_FAILED:${t("github.authFailed")}`,
    };
  }

  if (res.status === 403) {
    const jsonResult = await ResultAsync.fromPromise(
      res.json() as Promise<Record<string, unknown>>,
      () => ({})
    );
    const data = jsonResult.unwrapOr({});
    const msg = (data as { message?: string }).message ?? "";
    if (msg.toLowerCase().includes("rate limit")) {
      return {
        valid: false,
        error: `RATE_LIMIT:${t("github.rateLimit")}`,
      };
    }
    return { valid: false, error: `AUTH_FAILED:${t("github.tokenInsufficient")}` };
  }

  return {
    valid: false,
    error: `AUTH_FAILED:${t("github.verifyFailed", { status: res.status })}`,
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
    () => null
  )();
  if (urlResult.isErr()) return null;

  const parsed = urlResult.value;
  if (parsed.hostname !== "github.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, repo, treeKeyword, ...branchParts] = parts;
  if (!owner || !repo) return null;

  const branch =
    treeKeyword === "tree" && branchParts.length > 0 ? branchParts.join("/") : undefined;

  return { owner, repo, branch };
};

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export const fetchRepoInfo = (
  owner: string,
  repo: string,
  token?: string | null,
  branchHint?: string
): ResultAsync<GitHubRepoInfo, string> => {
  const t = i18n.t.bind(i18n);
  const headers = getGitHubHeaders(token);

  return ResultAsync.fromPromise(
    fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers }),
    () => t("github.connectError")
  ).andThen((repoRes) => {
    if (repoRes.ok) {
      return ResultAsync.fromPromise(
        repoRes.json() as Promise<Record<string, unknown>>,
        () => t("github.parseRepoError")
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
          ? t("github.repoNotFoundWithToken")
          : t("github.repoNotFoundNoToken")
      );
    }

    if (repoRes.status === 401 || repoRes.status === 403) {
      return errAsync(t("github.noAccess"));
    }

    return errAsync(t("github.fetchRepoFailed", { status: repoRes.status }));
  });
};
