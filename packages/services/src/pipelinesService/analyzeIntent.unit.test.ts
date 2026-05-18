import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunAgent = vi.fn();
const mockDao = {
  findMany: vi.fn(),
  findById: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
  update: vi.fn(),
  delete: vi.fn(),
};
const mockOperationsDao = {
  findMany: vi.fn().mockResolvedValue([
    {
      id: "op-lint",
      name: "lint-code",
      description: "Run linting on source code",
      acceptedObjectTypes: ["file", "folder"],
    },
    {
      id: "op-test",
      name: "run-tests",
      description: "Execute unit tests",
      acceptedObjectTypes: ["github-project"],
    },
    {
      id: "op-format",
      name: "format-code",
      description: "Auto-format source files",
      acceptedObjectTypes: ["file", "folder"],
    },
    {
      id: "op-deploy",
      name: "deploy-app",
      description: "Deploy application to server",
      acceptedObjectTypes: ["github-project"],
    },
  ]),
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

describe("analyzeIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when description is empty", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.analyzeIntent({ name: "My Pipeline", description: "" });

    expect(result).toEqual({ matchedOperations: [], unmatchedSteps: [] });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("returns empty result when description is whitespace-only", async () => {
    const svc = createPipelinesService({} as never);
    const result = await svc.analyzeIntent({ name: "Pipeline", description: "   " });

    expect(result).toEqual({ matchedOperations: [], unmatchedSteps: [] });
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it("returns matched operations and unmatched steps from agent analysis", async () => {
    const agentResponse = JSON.stringify({
      matchedOperations: [
        { operationId: "op-lint", operationName: "lint-code", reason: "User wants to lint code" },
        { operationId: "op-test", operationName: "run-tests", reason: "User wants to run tests" },
      ],
      unmatchedSteps: [
        {
          step: "Generate coverage report",
          reason: "No existing operation for coverage reporting",
        },
      ],
    });
    mockRunAgent.mockResolvedValue(agentResponse);

    const svc = createPipelinesService({} as never);
    const result = await svc.analyzeIntent({
      name: "CI Pipeline",
      description: "Lint code, run tests, and generate coverage report",
    });

    expect(result.matchedOperations).toHaveLength(2);
    expect(result.matchedOperations[0]!.operationId).toBe("op-lint");
    expect(result.matchedOperations[1]!.operationId).toBe("op-test");
    expect(result.unmatchedSteps).toHaveLength(1);
    expect(result.unmatchedSteps[0]!.step).toBe("Generate coverage report");
  });

  it("returns empty result when agent fails", async () => {
    mockRunAgent.mockRejectedValue(new Error("Agent unavailable"));

    const svc = createPipelinesService({} as never);
    const result = await svc.analyzeIntent({
      name: "Failing",
      description: "This should fail gracefully",
    });

    expect(result).toEqual({ matchedOperations: [], unmatchedSteps: [] });
  });

  it("returns empty result when agent returns invalid JSON", async () => {
    mockRunAgent.mockResolvedValue("not valid json");

    const svc = createPipelinesService({} as never);
    const result = await svc.analyzeIntent({
      name: "Bad JSON",
      description: "Agent returns garbage",
    });

    expect(result).toEqual({ matchedOperations: [], unmatchedSteps: [] });
  });

  it("passes operations list to agent in user prompt", async () => {
    mockRunAgent.mockResolvedValue(JSON.stringify({ matchedOperations: [], unmatchedSteps: [] }));

    const svc = createPipelinesService({} as never);
    await svc.analyzeIntent({
      name: "Test",
      description: "Run linting",
    });

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    const callArgs = mockRunAgent.mock.calls[0]![0] as { userPrompt: string };
    expect(callArgs.userPrompt).toContain("op-lint");
    expect(callArgs.userPrompt).toContain("lint-code");
    expect(callArgs.userPrompt).toContain("Run linting");
  });
});
