import { describe, it, expect, vi, beforeEach } from "vitest";
import { pluginRegistry } from "@repo/plugin";
import { githubProjectsPlugin } from "./github-project-plugin";

describe("githubProjectsPlugin", () => {
  beforeEach(() => {
    pluginRegistry.clear();
  });

  it("has correct plugin metadata", () => {
    expect(githubProjectsPlugin.id).toBe("builtin:github-projects");
    expect(githubProjectsPlugin.name).toBe("GitHub Projects");
    expect(githubProjectsPlugin.version).toBe("1.0.0");
  });

  it("defines a github-project object type", () => {
    expect(githubProjectsPlugin.objectTypes).toHaveLength(1);
    const objType = githubProjectsPlugin.objectTypes![0]!;
    expect(objType.id).toBe("github-project");
    expect(objType.label).toBe("GitHub Projects");
    expect(objType.icon).toBe("github");
  });

  it("registers into pluginRegistry", () => {
    pluginRegistry.register(githubProjectsPlugin);

    expect(pluginRegistry.getPlugin("builtin:github-projects")).toBeDefined();
    expect(pluginRegistry.hasObjectType("github-project")).toBe(true);
    expect(pluginRegistry.getNodeHandler("github-project")).toBeDefined();
  });

  it("throws on duplicate registration", () => {
    pluginRegistry.register(githubProjectsPlugin);

    expect(() => pluginRegistry.register(githubProjectsPlugin)).toThrow(
      'Plugin "builtin:github-projects" is already registered',
    );
  });

  describe("nodeHandler", () => {
    const handler = githubProjectsPlugin.objectTypes![0]!.nodeHandler;

    const createCtx = (data: Record<string, unknown>) => ({
      nodeId: "node-1",
      jobId: "job-1",
      data,
      input: { inputPath: "/tmp/input", content: "test-content" },
      setOutput: vi.fn(),
      trace: vi.fn(async () => {}),
    });

    it("handles github source type", async () => {
      const ctx = createCtx({ owner: "octocat", repo: "hello-world", branch: "main" });
      const result = await handler(ctx);

      expect(result).toEqual({ ok: true });
      expect(ctx.setOutput).toHaveBeenCalledWith({
        inputPath: "/tmp/input",
        content: "Repository: octocat/hello-world (branch: main)",
      });
      expect(ctx.trace).toHaveBeenCalledWith("GitHub project: octocat/hello-world@main");
    });

    it("uses default branch when not specified", async () => {
      const ctx = createCtx({ owner: "octocat", repo: "hello-world" });
      const result = await handler(ctx);

      expect(result).toEqual({ ok: true });
      expect(ctx.setOutput).toHaveBeenCalledWith({
        inputPath: "/tmp/input",
        content: "Repository: octocat/hello-world (branch: main)",
      });
    });

    it("handles local source type", async () => {
      const ctx = createCtx({
        sourceType: "local",
        localPath: "/path/to/project",
        owner: "",
        repo: "",
      });
      const result = await handler(ctx);

      expect(result).toEqual({ ok: true });
      expect(ctx.setOutput).toHaveBeenCalledWith({
        inputPath: "/path/to/project",
        content: "Local Folder: /path/to/project",
      });
    });

    it("handles local source type with missing localPath", async () => {
      const ctx = createCtx({ sourceType: "local", owner: "", repo: "" });
      const result = await handler(ctx);

      expect(result).toEqual({ ok: true });
      expect(ctx.setOutput).toHaveBeenCalledWith({ inputPath: "", content: "" });
      expect(ctx.trace).toHaveBeenCalledWith(
        "WARNING: GitHub project node (local) missing localPath, skipping",
      );
    });

    it("handles missing owner/repo", async () => {
      const ctx = createCtx({ owner: "", repo: "" });
      const result = await handler(ctx);

      expect(result).toEqual({ ok: true });
      expect(ctx.setOutput).toHaveBeenCalledWith({ inputPath: "", content: "" });
      expect(ctx.trace).toHaveBeenCalledWith(
        "WARNING: GitHub project node missing owner/repo, skipping",
      );
    });
  });

  describe("dataSchema validation", () => {
    const schema = githubProjectsPlugin.objectTypes![0]!.dataSchema;

    it("validates valid github project data", () => {
      const result = schema.safeParse({
        label: "My Project",
        owner: "octocat",
        repo: "hello-world",
        branch: "main",
      });

      expect(result.success).toBe(true);
    });

    it("validates with all optional fields", () => {
      const result = schema.safeParse({
        label: "My Project",
        owner: "octocat",
        repo: "hello-world",
        sourceType: "local",
        localPath: "/path",
        disclosureMode: "full",
        excludedPaths: ["node_modules"],
        isPrivate: true,
      });

      expect(result.success).toBe(true);
    });

    it("rejects invalid disclosure mode", () => {
      const result = schema.safeParse({
        label: "My Project",
        owner: "octocat",
        repo: "hello-world",
        disclosureMode: "invalid",
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing required fields", () => {
      const result = schema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});
