import { describe, it, expect, vi, beforeEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { okAsync } from "neverthrow";

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
const mockAgentRuntimesDao = {
  findMany: vi.fn().mockResolvedValue([]),
};

vi.mock("@repo/models", () => ({
  createAgentRuntimesDao: () => mockAgentRuntimesDao,
  createConversationMessagesDao: () => ({ findManyByPipelineId: vi.fn().mockResolvedValue([]) }),
  createPipelinesDao: () => mockDao,
  createDistillationsDao: () => ({}),
  createJobsDao: () => ({}),
  createPipelineRunsDao: () => ({ findByJobId: vi.fn() }),
  createJobTracesDao: () => ({}),
  createOperationsDao: () => mockOperationsDao,
  createOperationRegistryRepository: () => ({ runSerializable: vi.fn() }),
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
    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }
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

  it("fills a missing prompt from the node description without an Agent retry", async () => {
    const invalidStructure = {
      nodes: [
        {
          id: "prompt-1",
          type: "prompt",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "prompt",
            label: "Prompt",
            description: "Review this repository",
          },
        },
      ],
      edges: [],
    };
    mockRunAgent.mockResolvedValueOnce(JSON.stringify(invalidStructure));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Review Pipeline",
      description: "Review a repository",
    });

    expect("error" in result).toBe(false);
    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    if ("error" in result) return;
    expect(result.nodes[0]?.data).toMatchObject({ prompt: "Review this repository" });
  });

  it("repairs an illegal output-to-operation edge before returning a graph", async () => {
    const outputNode = {
      id: "output-1",
      type: "output-local-path",
      position: { x: 300, y: 0 },
      data: { nodeType: "output-local-path", label: "Output", localPath: "/tmp/out" },
    };
    const operationNode = {
      id: "operation-1",
      type: "operation",
      position: { x: 0, y: 0 },
      data: {
        nodeType: "operation",
        label: "Review",
        operationId: "review-code",
        operationName: "Review Code",
        status: "idle",
      },
    };
    mockRunAgent
      .mockResolvedValueOnce(
        JSON.stringify({
          nodes: [outputNode, operationNode],
          edges: [{ id: "edge-1", source: outputNode.id, target: operationNode.id }],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          nodes: [operationNode, outputNode],
          edges: [{ id: "edge-1", source: operationNode.id, target: outputNode.id }],
        }),
      );

    const result = await createPipelinesService({} as never).generateStructure({
      name: "Review Pipeline",
      description: "Review code and write a report",
    });

    expect("error" in result).toBe(false);
    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    const repairCall = mockRunAgent.mock.calls[1]![0] as { userPrompt: string };
    expect(repairCall.userPrompt).toContain(
      "Connection output-local-path -> operation is not allowed",
    );
    expect(repairCall.userPrompt).not.toContain("=== PIPELINE GOAL ===");
    expect(repairCall.userPrompt).not.toContain("=== AVAILABLE OPERATIONS");
    expect(repairCall.userPrompt).toContain(JSON.stringify(outputNode));
  });

  it("normalizes the common GitHub project alias and owner/repo shorthand", async () => {
    mockRunAgent.mockResolvedValue(
      JSON.stringify({
        nodes: [
          {
            id: "repo-1",
            type: "github-projects",
            position: { x: 0, y: 0 },
            data: {
              nodeType: "github-projects",
              label: "ORDINE",
              repo: "forge-town/ordine",
              sourceType: "github",
            },
          },
        ],
        edges: [],
      }),
    );

    const result = await createPipelinesService({} as never).generateStructure({
      name: "ORDINE Review",
      description: "Review forge-town/ordine",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.nodes[0]).toMatchObject({
      type: "github-project",
      data: {
        nodeType: "github-project",
        owner: "forge-town",
        repo: "ordine",
      },
    });
  });

  it.runIf(process.platform === "win32")(
    "normalizes a POSIX-prefixed Windows drive path",
    async () => {
      mockRunAgent.mockResolvedValue(
        JSON.stringify({
          nodes: [
            {
              id: "folder-1",
              type: "folder",
              position: { x: 0, y: 0 },
              data: {
                nodeType: "folder",
                label: "Project",
                folderPath: "/D:/Coding/project",
              },
            },
          ],
          edges: [],
        }),
      );

      const result = await createPipelinesService({} as never).generateStructure({
        name: "Windows Project",
        description: "Read the project on D drive",
      });

      expect("error" in result).toBe(false);
      if ("error" in result) return;
      expect(result.nodes[0]?.data).toMatchObject({ folderPath: "D:\\Coding\\project" });
    },
  );

  it("stops after one schema repair retry when the structure remains invalid", async () => {
    const invalidStructure = {
      nodes: [
        {
          id: "output-1",
          type: "output-local-path",
          position: { x: 0, y: 0 },
          data: { nodeType: "output-local-path", label: "Output", localPath: "/tmp/out" },
        },
        {
          id: "operation-1",
          type: "operation",
          position: { x: 300, y: 0 },
          data: {
            nodeType: "operation",
            label: "Review",
            operationId: "review-code",
            operationName: "Review Code",
            status: "idle",
          },
        },
      ],
      edges: [{ id: "edge-1", source: "output-1", target: "operation-1" }],
    };
    mockRunAgent.mockResolvedValue(JSON.stringify(invalidStructure));

    const svc = createPipelinesService({} as never);
    const result = await svc.generateStructure({
      name: "Invalid Pipeline",
      description: "Return an invalid prompt node",
    });

    expect(result).toEqual({ error: "Agent returned invalid pipeline structure" });
    expect(mockRunAgent).toHaveBeenCalledTimes(2);
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
    const desktopPath = join(home, "Desktop");
    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }
    const folderNode = result.nodes.find((n) => n.data.nodeType === "folder");
    expect(folderNode!.data).toHaveProperty("folderPath", desktopPath);

    const outputNode = result.nodes.find((n) => n.data.nodeType === "output-local-path");
    expect(outputNode!.data).toHaveProperty("localPath", desktopPath);
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
          id: "op1",
          type: "operation",
          position: { x: 0, y: 160 },
          data: {
            nodeType: "operation",
            label: "Fetch Polymarket data",
            operationId: "op-auto-1",
            operationName: "Fetch Polymarket data",
            status: "idle",
          },
        },
        {
          id: "op2",
          type: "operation",
          position: { x: 0, y: 320 },
          data: {
            nodeType: "operation",
            label: "Summarize into markdown",
            operationId: "op-auto-2",
            operationName: "Summarize into markdown",
            status: "idle",
          },
        },
        {
          id: "n2",
          type: "output-local-path",
          position: { x: 0, y: 480 },
          data: { nodeType: "output-local-path", label: "Output", localPath: "/tmp/out" },
        },
      ],
      edges: [
        { id: "e1", source: "n1", target: "op1" },
        { id: "e2", source: "op1", target: "op2" },
        { id: "e3", source: "op2", target: "n2" },
      ],
    };

    mockAgentRuntimesDao.findMany.mockResolvedValueOnce([
      {
        id: "runtime-hermes",
        type: "hermes",
        connection: {
          mode: "local",
          models: [{ id: "hermes-model", displayName: "Hermes", isDefault: true }],
        },
      },
    ]);
    mockRunAgent.mockImplementation(async (input: { agentId: string; userPrompt: string }) => {
      if (input.agentId !== "pipeline-capability-assignment") {
        return JSON.stringify(generatedPipeline);
      }

      const operationIds = [...input.userPrompt.matchAll(/"operationId": "(op_auto_[^"]+)"/gu)].map(
        (match) => match[1]!,
      );

      return JSON.stringify({
        assignments: [
          {
            operationId: operationIds[0],
            executor: {
              type: "script",
              language: "bash",
              command: "curl -fsSL https://example.invalid/data",
              assignmentReason: "Calling a fixed API is deterministic and needs no model.",
            },
          },
          {
            operationId: operationIds[1],
            executor: {
              type: "agent",
              agentMode: "prompt",
              agent: "hermes",
              model: "hermes-model",
              prompt: "Summarize the supplied data into structured markdown.",
              allowedTools: [],
              assignmentReason: "Summarization needs model judgment but no external capability.",
            },
          },
        ],
      });
    });

    const capabilityCatalog = {
      getMany: vi.fn(() => okAsync([])),
      validateOperationConfigs: vi.fn(() => okAsync(undefined)),
    };

    const svc = createPipelinesService({} as never, {
      capabilityCatalog: capabilityCatalog as never,
    });
    const result = await svc.generateStructure({
      name: "Polymarket Pipeline",
      description: "Collect Polymarket trends",
      matchedOperations: [],
      runtimeType: "hermes",
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
      expect(result.pendingOperations![0]!.description).toBe(
        "Execute this Pipeline step: Fetch Polymarket data",
      );
      expect(result.pendingOperations![0]!.description).not.toContain("No data fetching");
      expect(result.pendingOperations![0]!.config.executor).toMatchObject({
        type: "script",
        command: "curl -fsSL https://example.invalid/data",
      });
      expect(result.pendingOperations![1]!.config.executor).toMatchObject({
        type: "agent",
        agent: "hermes",
        model: "hermes-model",
        allowedTools: [],
      });
      const operationNodeRuntimes = result.nodes.flatMap((node) =>
        node.data.nodeType === "operation" ? [node.data.agentRuntime] : [],
      );
      expect(operationNodeRuntimes).toHaveLength(2);
      expect(operationNodeRuntimes.every((runtime) => runtime === undefined)).toBe(true);
    }

    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    expect(capabilityCatalog.validateOperationConfigs).toHaveBeenCalledOnce();
    const assignmentCall = mockRunAgent.mock.calls[0]![0] as {
      agentId: string;
      model: string;
      systemPrompt: string;
      userPrompt: string;
    };
    expect(assignmentCall.agentId).toBe("pipeline-capability-assignment");
    expect(assignmentCall.model).toBe("hermes-model");
    expect(assignmentCall.systemPrompt).toContain("calling a known API");
    const agentCall = mockRunAgent.mock.calls[1]![0] as { userPrompt: string };
    expect(agentCall.userPrompt).toContain("NEWLY CREATED OPERATIONS (MUST USE)");
    expect(agentCall.userPrompt).toContain("Fetch Polymarket data");
    expect(agentCall.userPrompt).toContain("Summarize into markdown");
    expect(agentCall.userPrompt).not.toContain("UNMATCHED STEPS");
    expect(agentCall.userPrompt).not.toContain("lint-code");
  });
});
