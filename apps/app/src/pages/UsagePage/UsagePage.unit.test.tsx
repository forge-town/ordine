import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { UsagePage } from "./UsagePage";

const mockData = {
  pipelines: [
    {
      id: "pipeline-1",
      name: "Lead Research Brief",
      description: "",
      projectId: null,
      status: "ready",
      tags: [],
      nodes: [],
      edges: [],
      timeoutMs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: mockData.pipelines }, query: { isLoading: false } }),
  useCustom: ({ url }: { url: string }) => {
    if (url === "usage/summary") {
      return {
        result: {
          data: { avgCostPerRun: 0.25, runCount: 4, totalCost: 1, totalTokens: 12_000 },
        },
        query: { isLoading: false },
      };
    }
    if (url === "usage/dailyCost") {
      return {
        result: { data: [{ cost: 1, date: "2026-06-10", tokens: 12_000 }] },
        query: { isLoading: false },
      };
    }
    if (url === "usage/byPipeline") {
      return {
        result: {
          data: [{ pipelineId: "pipeline-1", runCount: 4, totalCost: 1, totalTokens: 12_000 }],
        },
        query: { isLoading: false },
      };
    }
    if (url === "usage/byAgent") {
      return {
        result: {
          data: [
            {
              agentId: "claude-code",
              agentRuntime: "claude-code",
              modelId: "sonnet",
              runCount: 4,
              tokens: 12_000,
            },
          ],
        },
        query: { isLoading: false },
      };
    }

    return { result: { data: null }, query: { isLoading: false } };
  },
}));

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="usage-chart">{children}</div>
    ),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsagePage", () => {
  it("renders usage summary, chart, and breakdowns", () => {
    render(<UsagePage />);

    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByText("Total tokens")).toBeInTheDocument();
    expect(screen.getByText("12k")).toBeInTheDocument();
    expect(screen.getByTestId("usage-chart")).toBeInTheDocument();
    expect(screen.getByText("Lead Research Brief")).toBeInTheDocument();
    expect(screen.getByText("claude-code")).toBeInTheDocument();
  });
});
