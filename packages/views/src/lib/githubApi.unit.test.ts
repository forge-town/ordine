import { describe, expect, it, vi } from "vitest";
import { verifyGitHubToken } from "./githubApi";

describe("verifyGitHubToken", () => {
  it("uses the platform request transport for GitHub API calls", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ login: "octocat" }), { status: 200 }));

    await expect(verifyGitHubToken("github-token", request)).resolves.toEqual({
      valid: true,
      login: "octocat",
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer github-token" }) }),
    );
  });
});
