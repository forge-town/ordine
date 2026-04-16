import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { pipelineEngine } from "./engine";
import type { PipelineEngineDeps } from "./deps";
import type { PipelineNode, PipelineEdge } from "./schemas";
import type { ExecutePipelineOpts } from "./engine";

const testDir = join(tmpdir(), `engine-test-${Date.now()}`);

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

const makeDeps = (overrides: Partial<PipelineEngineDeps> = {}): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("prompt-output")),
  runSkill: vi.fn().mockReturnValue(okAsync("skill-output")),
  runRuleCheck: vi.fn().mockResolvedValue({ stats: { totalFindings: 0, totalFiles: 0 } }),
  structuredJsonToMarkdown: vi.fn((c: string) => `# Markdown\n${c}`),
  listDirTree: vi.fn().mockResolvedValue("file1.ts\nfile2.ts"),
  readProjectFiles: vi.fn().mockResolvedValue("// file1 content\n// file2 content"),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  log: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeNode = (
  id: string,
  type: PipelineNode["type"],
  data: Record<string, unknown> = {},
): PipelineNode => ({
  id,
  type,
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
  extra: Partial<ExecutePipelineOpts> = {},
): ExecutePipelineOpts => ({
  pipeline: { id: "p1", name: "Test Pipeline", nodes, edges },
  jobId: "job-12345678",
  operations: new Map(),
  deps,
  lookupSkill: vi.fn().mockResolvedValue(null),
  lookupBestPractice: vi.fn().mockResolvedValue(null),
  ...extra,
});

describe("executePipeline", () => {
  it("returns ok for an empty pipeline", async () => {
    const deps = makeDeps();
    const result = await pipelineEngine.execute(makeOpts([], [], deps));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("Completed");
    }
  });

  it("returns error for cyclic graph", async () => {
    const deps = makeDeps();
    const nodes = [makeNode("a", "operation"), makeNode("b", "operation")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "a")];
    const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps));
    expect(result.ok).toBe(false);
  });

  describe("folder node", () => {
    it("processes a folder node with tree disclosure", async () => {
      const folderPath = join(testDir, "project-folder");
      await mkdir(folderPath, { recursive: true });
      await writeFile(join(folderPath, "index.ts"), "export {};", "utf8");

      const deps = makeDeps();
      const nodes = [makeNode("f1", "folder", { folderPath, disclosureMode: "tree" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
      expect(deps.listDirTree).toHaveBeenCalledWith(folderPath, { excludedPaths: [] });
    });

    it("processes a folder node with full disclosure (tree + content)", async () => {
      const folderPath = join(testDir, "full-folder");
      await mkdir(folderPath, { recursive: true });

      const deps = makeDeps();
      const nodes = [makeNode("f1", "folder", { folderPath, disclosureMode: "full" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
      expect(deps.listDirTree).toHaveBeenCalled();
      expect(deps.readProjectFiles).toHaveBeenCalled();
    });

    it("handles non-existent folder gracefully", async () => {
      const deps = makeDeps();
      const nodes = [makeNode("f1", "folder", { folderPath: "/non-existent-xyz" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
    });
  });

  describe("code-file node", () => {
    it("reads a code file and passes content forward", async () => {
      const filePath = join(testDir, "test-code.ts");
      await writeFile(filePath, "const x = 42;", "utf8");

      const deps = makeDeps();
      const nodes = [makeNode("cf", "code-file", { filePath })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
    });

    it("handles non-existent code file", async () => {
      const deps = makeDeps();
      const nodes = [makeNode("cf", "code-file", { filePath: "/no-file-12345.ts" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
    });
  });

  describe("operation node", () => {
    it("executes a script operation", async () => {
      const deps = makeDeps();
      const opId = "op-script";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Echo Op",
            config: JSON.stringify({
              executor: { type: "script", language: "bash", command: "echo test-output" },
            }),
          },
        ],
      ]);

      const nodes = [
        makeNode("input", "folder", { folderPath: testDir }),
        makeNode("op", "operation", { operationId: opId, label: "Echo Op" }),
      ];
      const edges = [makeEdge("input", "op")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
    });

    it("executes a prompt operation", async () => {
      const deps = makeDeps();
      const opId = "op-prompt";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Prompt Op",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Analyze this code" } }),
          },
        ],
      ]);

      const nodes = [makeNode("op", "operation", { operationId: opId, label: "Prompt Op" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runPrompt).toHaveBeenCalled();
    });

    it("executes a skill operation", async () => {
      const deps = makeDeps();
      const opId = "op-skill";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Skill Op",
            config: JSON.stringify({ executor: { type: "skill", skillId: "sk-1" } }),
          },
        ],
      ]);
      const lookupSkill = vi
        .fn()
        .mockResolvedValue({ id: "sk-1", label: "Test Skill", description: "desc" });

      const nodes = [makeNode("op", "operation", { operationId: opId, label: "Skill Op" })];
      const result = await pipelineEngine.execute(
        makeOpts(nodes, [], deps, { operations, lookupSkill }),
      );
      expect(result.ok).toBe(true);
      expect(deps.runSkill).toHaveBeenCalled();
    });

    it("executes a rule-check operation", async () => {
      const deps = makeDeps();
      const opId = "op-rule";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Rule Check",
            config: JSON.stringify({ executor: { type: "rule-check" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("input", "folder", { folderPath: testDir }),
        makeNode("op", "operation", { operationId: opId, label: "Rule Check" }),
      ];
      const edges = [makeEdge("input", "op")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runRuleCheck).toHaveBeenCalled();
    });

    it("skips operation when operationId is not found", async () => {
      const deps = makeDeps();
      const nodes = [makeNode("op", "operation", { operationId: "missing-op" })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
    });

    it("skips operation with empty prompt", async () => {
      const deps = makeDeps();
      const opId = "op-empty-prompt";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Empty Prompt",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "" } }),
          },
        ],
      ]);

      const nodes = [makeNode("op", "operation", { operationId: opId })];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runPrompt).not.toHaveBeenCalled();
    });

    it("loads best practice content when bestPracticeId is set", async () => {
      const deps = makeDeps();
      const opId = "op-bp";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "BP Op",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Check standards" } }),
          },
        ],
      ]);
      const lookupBestPractice = vi
        .fn()
        .mockResolvedValue({ title: "DAO Guide", content: "Use class-based DAOs" });

      const nodes = [makeNode("op", "operation", { operationId: opId, bestPracticeId: "bp-1" })];
      const result = await pipelineEngine.execute(
        makeOpts(nodes, [], deps, { operations, lookupBestPractice }),
      );
      expect(result.ok).toBe(true);
      expect(lookupBestPractice).toHaveBeenCalledWith("bp-1");
    });
  });

  describe("operation loop", () => {
    it("loops until condition passes", async () => {
      const evaluateLoopCondition = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const deps = makeDeps({ evaluateLoopCondition });
      const opId = "op-loop";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Loop Op",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Improve" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("op", "operation", {
          operationId: opId,
          loopEnabled: true,
          maxLoopCount: 5,
          loopConditionPrompt: "Is it good enough?",
        }),
      ];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runPrompt).toHaveBeenCalledTimes(2);
      expect(evaluateLoopCondition).toHaveBeenCalledTimes(2);
    });

    it("respects maxLoopCount", async () => {
      const evaluateLoopCondition = vi.fn().mockResolvedValue(false);
      const deps = makeDeps({ evaluateLoopCondition });
      const opId = "op-loop-max";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Loop Max",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Keep going" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("op", "operation", {
          operationId: opId,
          loopEnabled: true,
          maxLoopCount: 3,
          loopConditionPrompt: "Done?",
        }),
      ];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runPrompt).toHaveBeenCalledTimes(3);
    });
  });

  describe("multi-node pipeline", () => {
    it("executes a linear pipeline: folder → operation → output-project-path", async () => {
      const deps = makeDeps();
      const opId = "op1";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Analyze",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Analyze" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("input", "folder", { folderPath: testDir }),
        makeNode("op", "operation", { operationId: opId }),
        makeNode("out", "output-project-path", { path: "/project" }),
      ];
      const edges = [makeEdge("input", "op"), makeEdge("op", "out")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
    });

    it("executes a fan-out pipeline with parallel operations", async () => {
      const deps = makeDeps();
      const opA = "op-a";
      const opB = "op-b";
      const operations = new Map([
        [
          opA,
          {
            id: opA,
            name: "Check A",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Check A" } }),
          },
        ],
        [
          opB,
          {
            id: opB,
            name: "Check B",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Check B" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("input", "folder", { folderPath: testDir }),
        makeNode("a", "operation", { operationId: opA }),
        makeNode("b", "operation", { operationId: opB }),
      ];
      const edges = [makeEdge("input", "a"), makeEdge("input", "b")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
      expect(deps.runPrompt).toHaveBeenCalledTimes(2);
    });

    it("merges parent outputs for fan-in node", async () => {
      const runPrompt = vi
        .fn()
        .mockReturnValueOnce(okAsync("output-A"))
        .mockReturnValueOnce(okAsync("output-B"))
        .mockReturnValueOnce(okAsync("merged-result"));
      const deps = makeDeps({ runPrompt });
      const opA = "op-a";
      const opB = "op-b";
      const opMerge = "op-merge";
      const operations = new Map([
        [
          opA,
          {
            id: opA,
            name: "A",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "A" } }),
          },
        ],
        [
          opB,
          {
            id: opB,
            name: "B",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "B" } }),
          },
        ],
        [
          opMerge,
          {
            id: opMerge,
            name: "Merge",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Merge" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("input", "folder", { folderPath: testDir }),
        makeNode("a", "operation", { operationId: opA }),
        makeNode("b", "operation", { operationId: opB }),
        makeNode("merge", "operation", { operationId: opMerge }),
      ];
      const edges = [
        makeEdge("input", "a"),
        makeEdge("input", "b"),
        makeEdge("a", "merge"),
        makeEdge("b", "merge"),
      ];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
      expect(runPrompt).toHaveBeenCalledTimes(3);
    });
  });

  describe("output-local-path node", () => {
    it("writes output to a local file", async () => {
      const outputDir = join(testDir, "output-test");
      await mkdir(outputDir, { recursive: true });

      const deps = makeDeps();
      const opId = "op-gen";
      const operations = new Map([
        [
          opId,
          {
            id: opId,
            name: "Gen",
            config: JSON.stringify({ executor: { type: "prompt", prompt: "Generate" } }),
          },
        ],
      ]);

      const nodes = [
        makeNode("op", "operation", { operationId: opId }),
        makeNode("out", "output-local-path", { localPath: outputDir, outputFileName: "result.md" }),
      ];
      const edges = [makeEdge("op", "out")];

      const result = await pipelineEngine.execute(makeOpts(nodes, edges, deps, { operations }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.summary).toContain("Output written to");
      }
    });
  });

  describe("github-project node (local source)", () => {
    it("processes a local github-project node", async () => {
      const localPath = join(testDir, "local-project");
      await mkdir(localPath, { recursive: true });

      const deps = makeDeps();
      const nodes = [
        makeNode("gh", "github-project", {
          sourceType: "local",
          localPath,
          owner: "",
          repo: "",
          disclosureMode: "tree",
        }),
      ];
      const result = await pipelineEngine.execute(makeOpts(nodes, [], deps));
      expect(result.ok).toBe(true);
      expect(deps.listDirTree).toHaveBeenCalledWith(localPath, { excludedPaths: [] });
    });
  });

  describe("inputPath support", () => {
    it("reads initial input file when inputPath is provided", async () => {
      const inputFile = join(testDir, "input.txt");
      await writeFile(inputFile, "initial content", "utf8");

      const deps = makeDeps();
      const nodes = [makeNode("op", "operation", { operationId: "missing" })];
      const result = await pipelineEngine.execute(
        makeOpts(nodes, [], deps, { inputPath: inputFile }),
      );
      expect(result.ok).toBe(true);
    });
  });
});
