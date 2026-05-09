import { describe, it, expect, vi, beforeEach } from "vitest";
import { homedir } from "node:os";

const mockRunAgent = vi.fn();
const mockDao = {
  findMany: vi.fn(),
  findById: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockOperationsDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([
      { id: "op-1", name: "lint-code", description: "Lint source code", acceptedObjectTypes: null },
    ]),
  create: vi.fn().mockImplementation((data: Record<string, unknown>) => Promise.resolve(data)),
};
const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "openai",
    defaultApiKey: "sk-test",
    defaultModel: "gpt-4o",
  }),
};

vi.mock("@repo/models", () => ({
  createPipelinesDao: () => mockDao,
  createDistillationsDao: () => ({}),
  createJobsDao: () => ({}),
  createPipelineRunsDao: () => ({ findByJobId: vi.fn() }),
  createJobTracesDao: () => ({}),
  createOperationsDao: () => mockOperationsDao,
  createSettingsDao: () => mockSettingsDao,
}));

vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: (...args: unknown[]) => mockRunAgent(...args),
}));

vi.mock("../settingsService/normalizeSettingsRecord", () => ({
  normalizeSettingsRecord: (s: unknown) => s,
}));

import { createPipelinesService } from "./createPipelinesService";

describe("generateStructure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty nodes/edges when description is empty", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({ name: "My Pipeline", description: "" });

    expect(result).toEqual({ nodes: [], edges: [] });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("returns empty nodes/edges when description is whitespace-only", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({ name: "My Pipeline", description: "   " });

    expect(result).toEqual({ nodes: [], edges: [] });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("calls agent and returns generated nodes/edges for non-empty description", async () => {
    const generatedPipeline = {
      id: "gen-1",
      name: "Generated",
      description: "A pipeline",
      tags: [],
      timeoutMs: null,
      nodes: [
        {
          id: "n1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { nodeType: "folder", label: "Input", folderPath: "/src" },
        },
        {
          id: "n2",
          type: "operation",
          position: { x: 0, y: 200 },
          data: {
            nodeType: "operation",
            label: "Lint",
            operationId: "op-1",
            operationName: "lint-code",
            status: "idle",
          },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    mockRunAgent.mockResolvedValue(JSON.stringify(generatedPipeline));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Lint Pipeline",
      description: "A pipeline that lints my source code folder",
    });

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    if ("error" in result) throw new Error("unexpected error");
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0]!.data.nodeType).toBe("folder");
    expect(result.nodes[1]!.data.nodeType).toBe("operation");
  });

  it("returns error when agent fails after retries", async () => {
    mockRunAgent.mockRejectedValue(new Error("Agent unavailable"));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Failing Pipeline",
      description: "This should fail gracefully",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBeDefined();
    }
  });

  it("returns error when agent returns invalid JSON", async () => {
    mockRunAgent.mockResolvedValue("not a valid json at all");

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Bad JSON Pipeline",
      description: "Agent returns garbage",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBeDefined();
    }
  });

  it("expands ~ in folder and output-local-path nodes", async () => {
    const generatedPipeline = {
      nodes: [
        {
          id: "n1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { nodeType: "folder", label: "桌面", folderPath: "~/Desktop" },
        },
        {
          id: "n2",
          type: "output-local-path",
          position: { x: 0, y: 200 },
          data: { nodeType: "output-local-path", label: "Output", localPath: "~/Desktop" },
        },
      ],
      edges: [],
    };

    mockRunAgent.mockResolvedValue(JSON.stringify(generatedPipeline));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Test",
      description: "Generate a test file on Desktop",
    });

    const home = homedir();
    if ("error" in result) throw new Error("unexpected error");
    const folderNode = result.nodes.find((n) => n.data.nodeType === "folder");
    expect(folderNode!.data).toHaveProperty("folderPath", `${home}/Desktop`);

    const outputNode = result.nodes.find((n) => n.data.nodeType === "output-local-path");
    expect(outputNode!.data).toHaveProperty("localPath", `${home}/Desktop`);
  });

  it("includes matchedOperations block in user prompt when provided", async () => {
    const generatedPipeline = {
      nodes: [
        {
          id: "n1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { nodeType: "folder", label: "Input", folderPath: "/src" },
        },
        {
          id: "n2",
          type: "operation",
          position: { x: 0, y: 200 },
          data: {
            nodeType: "operation",
            label: "Lint",
            operationId: "op-1",
            operationName: "lint-code",
            status: "idle",
          },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    mockRunAgent.mockResolvedValue(JSON.stringify(generatedPipeline));

    const svc = createPipelinesService({} as never);
    await svc.generateStructure({
      name: "Lint Pipeline",
      description: "Lint my code",
      matchedOperations: [
        { operationId: "op-1", operationName: "lint-code", reason: "Matches linting intent" },
      ],
    });

    const agentCall = mockRunAgent.mock.calls[0]![0] as { userPrompt: string };
    expect(agentCall.userPrompt).toContain("PRE-MATCHED OPERATIONS (MUST USE)");
    expect(agentCall.userPrompt).toContain("op-1");
    expect(agentCall.userPrompt).toContain("lint-code");
  });

  it("does not include matchedOperations block when array is empty", async () => {
    const generatedPipeline = {
      nodes: [
        {
          id: "n1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { nodeType: "folder", label: "Input", folderPath: "/src" },
        },
      ],
      edges: [],
    };

    mockRunAgent.mockResolvedValue(JSON.stringify(generatedPipeline));

    const svc = createPipelinesService({} as never);
    await svc.generateStructure({
      name: "Simple",
      description: "Do something",
      matchedOperations: [],
    });

    const agentCall = mockRunAgent.mock.calls[0]![0] as { userPrompt: string };
    expect(agentCall.userPrompt).not.toContain("PRE-MATCHED OPERATIONS");
  });

  it("does NOT persist operations for unmatched steps, returns them as pendingOperations", async () => {
    const generatedPipeline = {
      nodes: [
        {
          id: "n1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: { nodeType: "folder", label: "Input", folderPath: "/src" },
        },
        {
          id: "n2",
          type: "output-local-path",
          position: { x: 0, y: 200 },
          data: { nodeType: "output-local-path", label: "Output", localPath: "/tmp/out" },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2" }],
    };

    mockRunAgent.mockResolvedValue(JSON.stringify(generatedPipeline));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Polymarket Pipeline",
      description: "Collect Polymarket trends",
      matchedOperations: [],
      unmatchedSteps: [
        { step: "Fetch Polymarket data", reason: "No data fetching operation available" },
        { step: "Summarize into markdown", reason: "No summarization operation available" },
      ],
    });

    // Should NOT persist operations during structure generation
    expect(mockOperationsDao.create).not.toHaveBeenCalled();

    // Should return pending operations
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.pendingOperations).toHaveLength(2);
      expect(result.pendingOperations![0]!.name).toBe("Fetch Polymarket data");
      expect(result.pendingOperations![1]!.name).toBe("Summarize into markdown");
    }

    const agentCall = mockRunAgent.mock.calls[0]![0] as { userPrompt: string };
    expect(agentCall.userPrompt).toContain("NEWLY CREATED OPERATIONS (MUST USE)");
    expect(agentCall.userPrompt).toContain("Fetch Polymarket data");
    expect(agentCall.userPrompt).toContain("Summarize into markdown");
    expect(agentCall.userPrompt).not.toContain("UNMATCHED STEPS");
  });
});
