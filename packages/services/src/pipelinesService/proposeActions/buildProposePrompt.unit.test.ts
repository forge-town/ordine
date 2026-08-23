import { describe, expect, it } from "vitest";
import type { PipelineGraphSnapshot } from "@repo/schemas";
import { buildProposeUserPrompt, resolveSelectedElements } from "./buildProposePrompt";
import { DEFAULT_PROPOSE_SYSTEM_PROMPT } from "./runProposeAgent";

const snapshot: PipelineGraphSnapshot = {
  nodes: [
    {
      id: "n1",
      type: "prompt",
      position: { x: 0, y: 0 },
      data: { nodeType: "prompt", label: "Quiz prompt", prompt: "Write a quiz" },
    },
    {
      id: "vc",
      type: "operation",
      position: { x: 400, y: 0 },
      data: {
        nodeType: "operation",
        label: "Verify child",
        operationId: "op_1",
        operationName: "Verify",
        status: "idle",
      },
    },
  ],
  edges: [{ id: "e1", source: "n1", target: "vc" }],
} as PipelineGraphSnapshot;

const basePromptInput = {
  attachments: [],
  message: "Change the prompt wording",
  operationCatalog: [],
  pipelineId: "p1",
  pipelineName: "Quiz pipeline",
  snapshot,
};

describe("default propose system prompt", () => {
  it("includes the active Canvas skill and DAG topology guidance", () => {
    expect(DEFAULT_PROPOSE_SYSTEM_PROMPT).toContain("## Active skill — ordine-create-pipeline");
    expect(DEFAULT_PROPOSE_SYSTEM_PROMPT).toContain("根据真实数据依赖连边");
    expect(DEFAULT_PROPOSE_SYSTEM_PROMPT).toContain("并行后汇总");
    expect(DEFAULT_PROPOSE_SYSTEM_PROMPT).toContain("只接收其直接父节点的输出");
    expect(DEFAULT_PROPOSE_SYSTEM_PROMPT).toContain("完整成品正文");
  });
});

describe("resolveSelectedElements", () => {
  it("resolves a root node ref", () => {
    const { missing, resolved } = resolveSelectedElements(["n1"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ drillPath: [], kind: "node", refId: "n1" });
    expect(resolved[0]?.element).toMatchObject({ id: "n1" });
  });

  it("resolves an edge ref", () => {
    const { missing, resolved } = resolveSelectedElements(["e1"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved[0]).toMatchObject({ drillPath: [], kind: "edge", refId: "e1" });
    expect(resolved[0]?.element).toMatchObject({ source: "n1", target: "vc" });
  });

  it("resolves a drill-in ref by its last path segment and keeps the drill path", () => {
    const { missing, resolved } = resolveSelectedElements(["n4/vc"], snapshot);

    expect(missing).toEqual([]);
    expect(resolved[0]).toMatchObject({ drillPath: ["n4"], kind: "node", refId: "n4/vc" });
    expect(resolved[0]?.element).toMatchObject({ id: "vc" });
  });

  it("collects unknown refs as missing", () => {
    const { missing, resolved } = resolveSelectedElements(["ghost"], snapshot);

    expect(resolved).toEqual([]);
    expect(missing).toEqual(["ghost"]);
  });
});

describe("buildProposeUserPrompt history block", () => {
  it("injects conversation history before the user request", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      history: [
        { content: "add a verify step", hasProposal: false, role: "user" },
        { content: "Drafted it.", hasProposal: true, role: "agent" },
      ],
    });

    expect(prompt).toContain("=== CONVERSATION HISTORY (oldest first) ===");
    expect(prompt).toContain("[user]: add a verify step");
    expect(prompt).toContain("[assistant] (included a graph proposal): Drafted it.");
    expect(prompt.indexOf("=== CONVERSATION HISTORY")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("omits the history block when the conversation is empty", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== CONVERSATION HISTORY");
  });
});

describe("buildProposeUserPrompt diagnostics block", () => {
  it("injects diagnostics and the failed proposal for a fix round", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      diagnostics: ['Operation node "op-x" references unknown operationId "ghost".'],
      failedProposal: { summary: "broken", actions: [{ type: "removeNode", nodeId: "nx" }] },
    });

    expect(prompt).toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS ===");
    expect(prompt).toContain('- Operation node "op-x" references unknown operationId "ghost".');
    expect(prompt).toContain("Failed proposal for reference:");
    expect(prompt).toContain('"summary": "broken"');
    expect(prompt.indexOf("=== PREVIOUS PROPOSAL DIAGNOSTICS")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("omits the diagnostics block when there are none", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== PREVIOUS PROPOSAL DIAGNOSTICS");
  });
});

describe("buildProposeUserPrompt selection block", () => {
  it("omits the selection block when nothing is referenced", () => {
    const prompt = buildProposeUserPrompt(basePromptInput);

    expect(prompt).not.toContain("=== USER SELECTION ===");
  });

  it("includes selected element JSON and targeting instruction", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      referencedNodeIds: ["n1"],
    });

    expect(prompt).toContain("=== USER SELECTION ===");
    expect(prompt).toContain('"refId": "n1"');
    expect(prompt).toContain("Treat the user's request as targeting these elements.");
    expect(prompt.indexOf("=== USER SELECTION ===")).toBeLessThan(
      prompt.indexOf("=== USER REQUEST ==="),
    );
  });

  it("lists unknown refs so the agent can ignore them", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      referencedNodeIds: ["ghost"],
    });

    expect(prompt).toContain("Referenced ids not found in the current graph");
    expect(prompt).toContain("ghost");
  });
});

describe("buildProposeUserPrompt annotations block", () => {
  const context = {
    anchors: [
      { count: 2, label: "Verify child", refId: "vc" },
      { count: 1, refId: "n1" },
    ],
    selection: [],
    snapshotIncluded: true,
    threadWindow: { enabled: true, limit: 20 },
  };

  it("injects unresolved anchors with labels and counts", () => {
    const prompt = buildProposeUserPrompt({ ...basePromptInput, context });

    expect(prompt).toContain("=== USER ANNOTATIONS (unresolved node-anchored notes) ===");
    expect(prompt).toContain("- Verify child (vc): 2 unresolved note(s)");
    expect(prompt).toContain("- n1 (n1): 1 unresolved note(s)");
  });

  it("omits the block when context is missing or has no anchors", () => {
    const withoutContext = buildProposeUserPrompt(basePromptInput);
    const withoutAnchors = buildProposeUserPrompt({
      ...basePromptInput,
      context: { ...context, anchors: [] },
    });

    expect(withoutContext).not.toContain("USER ANNOTATIONS");
    expect(withoutAnchors).not.toContain("USER ANNOTATIONS");
  });
});

describe("buildProposeUserPrompt active run block", () => {
  const activeRun = {
    jobId: "job-1",
    jobStatus: "running",
    nodeStatuses: { vc: "running", n1: "done" },
    traces: [
      { level: "info", message: "Starting pipeline" },
      { level: "error", message: "Connector not authorized" },
    ],
  };

  it("injects job status, node statuses and traces oldest first", () => {
    const prompt = buildProposeUserPrompt({ ...basePromptInput, activeRun });

    expect(prompt).toContain("=== ACTIVE RUN ===");
    expect(prompt).toContain("Job job-1 — status: running");
    expect(prompt).toContain('"vc":"running"');
    expect(prompt).toContain("- [info] Starting pipeline");
    expect(prompt).toContain("- [error] Connector not authorized");
  });

  it("notes when the run has no traces yet", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      activeRun: { ...activeRun, traces: [] },
    });

    expect(prompt).toContain("No traces recorded yet.");
  });

  it("omits the block entirely when no run context is provided", () => {
    expect(buildProposeUserPrompt(basePromptInput)).not.toContain("ACTIVE RUN");
  });
});

describe("buildProposeUserPrompt artifact analysis block", () => {
  it("injects stage-one analysis when provided", () => {
    const prompt = buildProposeUserPrompt({
      ...basePromptInput,
      artifactAnalysis: {
        matchedComponentIds: ["op_1"],
        steps: ["parse PDF", "generate quiz"],
        structure: "20-question quiz with answers",
      },
    });

    expect(prompt).toContain("=== ARTIFACT ANALYSIS (stage one) ===");
    expect(prompt).toContain("Structure: 20-question quiz with answers");
    expect(prompt).toContain("1. parse PDF");
    expect(prompt).toContain("Existing operations matching these steps: op_1");
  });

  it("omits the block when no analysis is provided", () => {
    expect(buildProposeUserPrompt(basePromptInput)).not.toContain("ARTIFACT ANALYSIS");
  });
});
