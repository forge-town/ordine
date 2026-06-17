import { describe, expect, it } from "vitest";
import {
  buildCompareUrl,
  featureBranchName,
  isGitHubRepo,
  isOwnerRepo,
  isSshRepo,
  parseGitHubSlug,
  redactSecrets,
  resolveCloneUrl,
} from "./repoUrl";

describe("repoUrl helpers", () => {
  it("recognizes owner/repo shorthand and github urls", () => {
    expect(isOwnerRepo("forge-town/ordine")).toBe(true);
    expect(isOwnerRepo("https://github.com/forge-town/ordine")).toBe(false);
    expect(isGitHubRepo("forge-town/ordine")).toBe(true);
    expect(isGitHubRepo("https://github.com/forge-town/ordine.git")).toBe(true);
    expect(isGitHubRepo("file:///tmp/x.git")).toBe(false);
  });

  it("parses github slug from shorthand and full urls", () => {
    expect(parseGitHubSlug("forge-town/ordine")).toEqual({ owner: "forge-town", repo: "ordine" });
    expect(parseGitHubSlug("https://github.com/forge-town/ordine.git")).toEqual({
      owner: "forge-town",
      repo: "ordine",
    });
    expect(parseGitHubSlug("/tmp/local.git")).toBeNull();
  });

  it("injects x-access-token only for github; passes other urls through", () => {
    expect(resolveCloneUrl("forge-town/ordine", "tok")).toBe(
      "https://x-access-token:tok@github.com/forge-town/ordine.git",
    );
    expect(resolveCloneUrl("forge-town/ordine")).toBe("https://github.com/forge-town/ordine.git");
    expect(resolveCloneUrl("file:///tmp/x.git", "tok")).toBe("file:///tmp/x.git");
  });

  it("builds a compare url for github and a stable feature branch name", () => {
    expect(buildCompareUrl("forge-town/ordine", "ordine/publish-abc")).toBe(
      "https://github.com/forge-town/ordine/compare/ordine/publish-abc?expand=1",
    );
    expect(buildCompareUrl("/tmp/local.git", "b")).toBeNull();
    expect(featureBranchName("job-1234567890")).toBe("ordine/publish-job-1234");
    expect(featureBranchName()).toBe("ordine/publish-manual");
  });

  it("treats SSH remotes as self-authenticating and never rewrites them to https", () => {
    expect(isSshRepo("git@github.com:forge-town/ordine.git")).toBe(true);
    expect(isSshRepo("ssh://git@github.com/forge-town/ordine.git")).toBe(true);
    expect(isSshRepo("forge-town/ordine")).toBe(false);
    // SSH 原样返回（不注入 token、不改写 https），即便提供了 token
    expect(resolveCloneUrl("git@github.com:forge-town/ordine.git", "tok")).toBe(
      "git@github.com:forge-town/ordine.git",
    );
  });

  it("redacts inline url credentials (token must never persist)", () => {
    expect(redactSecrets("git clone https://x-access-token:ghp_SECRET@github.com/a/b.git d")).toBe(
      "git clone https://***@github.com/a/b.git d",
    );
    expect(redactSecrets("https://user:pass@example.com/x")).toBe("https://***@example.com/x");
    expect(redactSecrets("no creds here")).toBe("no creds here");
  });
});
