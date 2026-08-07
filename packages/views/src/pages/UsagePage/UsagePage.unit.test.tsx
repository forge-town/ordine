import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import { render } from "../../test/test-wrapper";
import { UsagePage } from "./UsagePage";

vi.mock("@refinedev/core", async (importOriginal) => {
  const actual = await importOriginal<typeof RefineCore>();

  return {
    ...actual,
    useList: () => ({
      result: { data: [{ id: "pipeline-1", name: "Release Review" }] },
      query: { isLoading: false },
    }),
    useCustom: ({ url }: { url: string }) => {
      const dataByUrl: Record<string, unknown> = {
        "usage/summary": { runCount: 4, totalTokens: 12_000 },
        "usage/dailyTokenSeries": [{ date: "08-07", tokens: 12_000 }],
        "usage/byPipeline": [{ pipelineId: "pipeline-1", runCount: 4, totalTokens: 12_000 }],
        "usage/byAgent": [
          {
            agentId: "codex-reviewer",
            agentRuntime: "codex",
            modelId: "gpt-5.6",
            runCount: 4,
            tokens: 12_000,
          },
        ],
      };

      return { result: { data: dataByUrl[url] }, query: { isLoading: false } };
    },
  };
});

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="usage-chart">{children}</div>
    ),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("UsagePage", () => {
  it("renders token-only summary, chart, and breakdowns", () => {
    render(<UsagePage />);

    expect(screen.getByRole("heading", { name: "Usage" })).toBeInTheDocument();
    expect(screen.getAllByText("12k").length).toBeGreaterThan(0);
    expect(screen.getByTestId("usage-chart")).toBeInTheDocument();
    expect(screen.getByText("Release Review")).toBeInTheDocument();
    expect(screen.getByText("codex-reviewer")).toBeInTheDocument();
    expect(screen.queryByText(/cost/i)).not.toBeInTheDocument();
  });
});
