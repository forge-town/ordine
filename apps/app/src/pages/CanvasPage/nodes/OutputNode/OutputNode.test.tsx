import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { OutputNode } from "./OutputNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

const baseData = {
  nodeType: "output" as const,
  label: "最终报告",
  expectedSchema: "{ summary: string, score: number }",
  notes: "输出给下游系统",
};

describe("OutputNode", () => {
  it("renders label", () => {
    render(<OutputNode data={baseData} />, { wrapper });
    expect(screen.getByText("最终报告")).toBeInTheDocument();
  });

  it("renders expectedSchema when provided", () => {
    render(<OutputNode data={baseData} />, { wrapper });
    expect(
      screen.getByText("{ summary: string, score: number }"),
    ).toBeInTheDocument();
  });

  it("renders notes when provided", () => {
    render(<OutputNode data={baseData} />, { wrapper });
    expect(screen.getByText("输出给下游系统")).toBeInTheDocument();
  });

  it("does not render expectedSchema section when absent", () => {
    render(
      <OutputNode data={{ ...baseData, expectedSchema: undefined }} />,
      { wrapper },
    );
    expect(screen.queryByText("期望产出")).not.toBeInTheDocument();
  });

  it("does not render notes when absent", () => {
    render(<OutputNode data={{ ...baseData, notes: undefined }} />, {
      wrapper,
    });
    expect(screen.queryByText("输出给下游系统")).not.toBeInTheDocument();
  });
});
