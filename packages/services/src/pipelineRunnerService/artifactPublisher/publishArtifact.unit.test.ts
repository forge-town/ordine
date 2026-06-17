import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishArtifact } from "./publishArtifact";

const git = (args: string[], cwd?: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).toString().trim();

describe("publishArtifact · localDir", () => {
  const ctx = { src: "", dest: "" };

  beforeEach(async () => {
    ctx.src = await mkdtemp(join(tmpdir(), "pub-src-"));
    ctx.dest = await mkdtemp(join(tmpdir(), "pub-dest-"));
    await writeFile(join(ctx.src, "index.html"), "<h1>hi</h1>");
  });

  afterEach(async () => {
    await rm(ctx.src, { recursive: true, force: true });
    await rm(ctx.dest, { recursive: true, force: true });
  });

  it("copies the source dir into target subPath", async () => {
    const result = await publishArtifact({
      sourceDir: ctx.src,
      target: "localDir",
      repo: ctx.dest,
      subPath: "ui-kit",
    });

    expect(result.isOk()).toBe(true);
    expect(await readFile(join(ctx.dest, "ui-kit", "index.html"), "utf8")).toBe("<h1>hi</h1>");
  });
});

describe("publishArtifact · git", () => {
  const ctx = { src: "", bare: "", seed: "" };

  beforeEach(async () => {
    ctx.src = await mkdtemp(join(tmpdir(), "pub-src-"));
    ctx.bare = join(await mkdtemp(join(tmpdir(), "pub-bare-")), "repo.git");
    ctx.seed = await mkdtemp(join(tmpdir(), "pub-seed-"));
    await writeFile(join(ctx.src, "Button.vue"), "<template/>");

    // 起一个带 main 分支 + 初始提交的本地裸仓库（无需网络）
    git(["init", "--bare", "-b", "main", ctx.bare]);
    git(["clone", ctx.bare, ctx.seed]);
    await writeFile(join(ctx.seed, "README.md"), "# seed");
    git(["add", "-A"], ctx.seed);
    git(["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-m", "seed"], ctx.seed);
    git(["push", "origin", "main"], ctx.seed);
  });

  afterEach(async () => {
    await rm(ctx.src, { recursive: true, force: true });
    await rm(ctx.bare, { recursive: true, force: true });
    await rm(ctx.seed, { recursive: true, force: true });
  });

  it("publishes to a NEW feature branch, never the base branch", async () => {
    const result = await publishArtifact({
      sourceDir: ctx.src,
      target: "git",
      repo: ctx.bare,
      branch: "main",
      subPath: "components/bifrost",
      commitMessage: "publish bifrost",
      openPr: false,
      jobId: "abcd1234",
    });

    expect(result.isOk()).toBe(true);
    const featureBranch = "ordine/publish-abcd1234";

    const branches = git(["for-each-ref", "--format=%(refname:short)"], ctx.bare);
    expect(branches).toContain(featureBranch);

    // 文件落在 feature 分支的 subPath
    const tree = git(["ls-tree", "-r", "--name-only", featureBranch], ctx.bare);
    expect(tree).toContain("components/bifrost/Button.vue");

    // base 分支 main 未被改动（无 publish 文件）
    const mainTree = git(["ls-tree", "-r", "--name-only", "main"], ctx.bare);
    expect(mainTree).not.toContain("Button.vue");
  });

  it("fails loudly when a github repo has no credential (no silent skip)", async () => {
    const result = await publishArtifact({
      sourceDir: ctx.src,
      target: "git",
      repo: "forge-town/ordine",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/credential/i);
  });
});
