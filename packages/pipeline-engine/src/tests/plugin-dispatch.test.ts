/**
 * Integration test: Plugin dispatch in Pipeline engine
 *
 * Replicates the structure of `pl_check_best_practices` pipeline
 * but uses a plugin-registered node type to verify the plugin
 * handler fallback path in processNode works end-to-end.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { pluginRegistry, definePlugin } from "@repo/plugin";
import { z } from "zod/v4";
import { pipelineEngine } from "../engine";
import type { PipelineEngineDeps } from "../deps";
import type { PipelineNode, PipelineEdge } from "../schemas";
import type { PipelineOptions } from "../pipeline";
import type { OperationInfo } from "../nodes/types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

const testDir = join(tmpdir(), `plugin-dispatch-test-${Date.now()}`);

beforeEach(() => {
  pluginRegistry.clear();
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

const makeDeps = (): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("prompt-output")),
  runSkill: vi.fn().mockReturnValue(okAsync("skill-output")),
  structuredJsonToMarkdown: vi.fn((c: string) => `# Markdown\n${c}`),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
});

const makeNode = (id: string, type: string, data: Record<string, unknown> = {}): PipelineNode => ({
  id,
  type: type as PipelineNode["type"],
  position: { x: 0, y: 0 },
  data: { label: id, nodeType: type, ...data } as PipelineNode["data"],
});

const makeEdge = (source: string, target: string): PipelineEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

const makeOpts = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  deps: PipelineEngineDeps,
  extra: Partial<PipelineOptions> = {},
): PipelineOptions => ({
  pipeline: { id: "test-pl", name: "Plugin Test Pipeline", nodes, edges },
  jobId: "job-plugin-test",
  operations: new Map(),
  deps,
  lookupSkill: vi.fn().mockResolvedValue(null),
  lookupBestPractice: vi.fn().mockResolvedValue(null),
  ...extra,
});

// ─── Test Plugin ─────────────────────────────────────────────────────────────
// Mirrors the github-project-plugin but uses a unique type ID so it
// falls through to the plugin dispatch instead of the built-in handler.

const testProjectDataSchema = z.object({
  label: z.string(),
  owner: z.string(),
  repo: z.string(),
  branch: z.string().optional(),
  sourceType: z.enum(["github", "local"]).optional(),
  localPath: z.string().optional(),
});

const handlerSpy = vi.fn();

const testProjectPlugin = definePlugin({
  id: "test:project-source",
  name: "Test Project Source",
  version: "1.0.0",
  objectTypes: [
    {
      id: "test-project-source",
      label: "Test Project Source",
      icon: "box",
      dataSchema: testProjectDataSchema,
      nodeHandler: async (ctx) => {
        handlerSpy(ctx);
        const data = ctx.data as z.infer<typeof testProjectDataSchema>;

        if (data.sourceType === "local") {
          const localPath = data.localPath ?? "";
          if (!localPath) {
            await ctx.trace("WARNING: missing localPath, skipping");
            ctx.setOutput({ inputPath: "", content: "" });

            return { ok: true };
          }
          await ctx.trace(`Using local folder: ${localPath}`);
          ctx.setOutput({ inputPath: localPath, content: `Local Folder: ${localPath}` });

          return { ok: true };
        }

        const owner = data.owner;
        const repo = data.repo;
        const branch = data.branch ?? "main";

        if (!owner || !repo) {
          await ctx.trace("WARNING: missing owner/repo, skipping");
          ctx.setOutput({ inputPath: "", content: "" });

          return { ok: true };
        }

        await ctx.trace(`Project: ${owner}/${repo}@${branch}`);
        ctx.setOutput({
          inputPath: ctx.input.inputPath,
          content: `Repository: ${owner}/${repo} (branch: ${branch})`,
        });

        return { ok: true };
      },
    },
  ],
});

describe("Plugin dispatch in Pipeline engine", () => {
  beforeEach(() => {
    handlerSpy.mockClear();
  });

  describe("replicating pl_check_best_practices with plugin node", () => {
    it("runs a single plugin-source node (github mode)", async () => {
      pluginRegistry.register(testProjectPlugin);
      const deps = makeDeps();

      const nodes = [
        makeNode("n_input", "test-project-source", {
          owner: "octocat",
          repo: "hello-world",
          branch: "main",
        }),
      ];

      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));

      expect(result.ok).toBe(true);
      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: "n_input",
          jobId: "job-plugin-test",
          data: expect.objectContaining({ owner: "octocat", repo: "hello-world" }),
        }),
      );
    });

    it("runs a single plugin-source node (local mode)", async () => {
      pluginRegistry.register(testProjectPlugin);
      const deps = makeDeps();

      const nodes = [
        makeNode("n_input", "test-project-source", {
          sourceType: "local",
          localPath: "/tmp/my-project",
          owner: "",
          repo: "",
        }),
      ];

      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));

      expect(result.ok).toBe(true);
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it("plugin output flows to downstream operation node", async () => {
      pluginRegistry.register(testProjectPlugin);
      const deps = makeDeps();
      const opId = "op_discover";
      const operations = new Map<string, OperationInfo>([
        [
          opId,
          {
            id: opId,
            name: "Discover Best Practices",
            config: {
              executor: {
                type: "agent",
                agentMode: "prompt",
                prompt: "List best practices for this project",
              },
            },
          },
        ],
      ]);

      const nodes = [
        makeNode("n_input", "test-project-source", {
          owner: "octocat",
          repo: "hello-world",
          branch: "main",
        }),
        makeNode("n_discover", "operation", {
          operationId: opId,
          operationName: "Discover Best Practices",
          status: "idle",
        }),
      ];
      const edges = [makeEdge("n_input", "n_discover")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));

      expect(result.ok).toBe(true);
      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(deps.runPrompt).toHaveBeenCalled();

      const promptCall = (deps.runPrompt as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(promptCall.inputContent).toContain("Repository: octocat/hello-world (branch: main)");
    });

    it("full pipeline: plugin-source → operation → output-local-path", async () => {
      pluginRegistry.register(testProjectPlugin);

      const outputPath = join(testDir, "quality-report.md");
      await mkdir(testDir, { recursive: true });

      const deps = makeDeps();
      const opId = "op_check";
      const operations = new Map<string, OperationInfo>([
        [
          opId,
          {
            id: opId,
            name: "Run Checks",
            config: {
              executor: {
                type: "agent",
                agentMode: "prompt",
                prompt: "Run quality checks on this project",
              },
            },
          },
        ],
      ]);

      const nodes = [
        makeNode("n_input", "test-project-source", {
          owner: "octocat",
          repo: "hello-world",
          branch: "main",
        }),
        makeNode("n_check", "operation", {
          operationId: opId,
          operationName: "Run Checks",
          status: "idle",
        }),
        makeNode("n_output", "output-local-path", {
          path: outputPath,
          outputMode: "overwrite",
        }),
      ];
      const edges = [makeEdge("n_input", "n_check"), makeEdge("n_check", "n_output")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));

      expect(result.ok).toBe(true);
      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(deps.runPrompt).toHaveBeenCalled();
    });

    it("plugin handler failure propagates as pipeline error", async () => {
      const failPlugin = definePlugin({
        id: "test:fail-source",
        name: "Failing Source",
        version: "1.0.0",
        objectTypes: [
          {
            id: "fail-source",
            label: "Fail Source",
            dataSchema: z.object({ label: z.string() }),
            nodeHandler: async () => ({ ok: false, error: new Error("Intentional failure") }),
          },
        ],
      });
      pluginRegistry.register(failPlugin);
      const deps = makeDeps();

      const nodes = [makeNode("n_fail", "fail-source", {})];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));

      expect(result.ok).toBe(false);
    });

    it("unregistered node type is skipped (passthrough)", async () => {
      const deps = makeDeps();

      const nodes = [
        makeNode("n_unknown", "nonexistent-type", { some: "data" }),
        makeNode("n_output", "output-local-path", {
          path: join(testDir, "skip-output.md"),
          outputMode: "overwrite",
        }),
      ];
      const edges = [makeEdge("n_unknown", "n_output")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps));

      expect(result.ok).toBe(true);
    });
  });
});
