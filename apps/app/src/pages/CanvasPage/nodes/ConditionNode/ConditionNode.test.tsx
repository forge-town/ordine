import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { ConditionNode } from "./ConditionNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "condition" as const,
  label: "质量检查",
  expression: "score >= 0.8",
  expectedResult: "通过阈值",
  status: "idle" as const,
};

describe("ConditionNode", () => {
  it("renders label", () => {
    render(<ConditionNode data={baseData} />, { wrapper });
    expect(screen.getByText("质量检查")).toBeInTheDocument();
  });

  it("renders condition expression", () => {
    render(<ConditionNode data={baseData} />, { wrapper });
    expect(screen.getByText("score >= 0.8")).toBeInTheDocument();
  });

  it("renders expectedResult", () => {
    render(<ConditionNode data={baseData} />, { wrapper });
    expect(screen.getByText("通过阈值")).toBeInTheDocument();
  });

  it("renders placeholder when expression is empty", () => {
    render(<ConditionNode data={{ ...baseData, expression: "" }} />, {
      wrapper,
    });
    expect(screen.getByText("未设置")).toBeInTheDocument();
  });

  it("shows status label for each status", () => {
    const { rerender } = render(
      <ConditionNode data={{ ...baseData, status: "idle" }} />,
      { wrapper },
    );
    expect(screen.getByText("待验收")).toBeInTheDocument();

    rerender(
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <ConditionNode data={{ ...baseData, status: "pass" }} />
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>,
    );
    expect(screen.getByText("通过")).toBeInTheDocument();

    rerender(
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <ConditionNode data={{ ...baseData, status: "fail" }} />
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>,
    );
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});
