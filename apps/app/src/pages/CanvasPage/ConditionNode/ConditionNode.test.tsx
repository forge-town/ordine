import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../_store";
import { ConditionNode } from "./ConditionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
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
    render(<ConditionNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("质量检查")).toBeInTheDocument();
  });

  it("renders condition expression", () => {
    render(<ConditionNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText("score >= 0.8")).toBeInTheDocument();
  });

  it("renders expectedResult", () => {
    render(<ConditionNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("通过阈值")).toBeInTheDocument();
  });

  it("renders placeholder when expression is empty", () => {
    render(<ConditionNode data={{ ...baseData, expression: "" }} id="test" />, {
      wrapper,
    });
    expect(screen.getByPlaceholderText("未设置表达式")).toBeInTheDocument();
  });

  it("shows status label for each status", () => {
    const { rerender } = render(
      <ConditionNode data={{ ...baseData, status: "idle" }} id="test" />,
      { wrapper }
    );
    expect(screen.getByText("待验收")).toBeInTheDocument();

    rerender(
      <HarnessCanvasStoreProvider>
        <ConditionNode data={{ ...baseData, status: "pass" }} id="test" />
      </HarnessCanvasStoreProvider>
    );
    expect(screen.getByText("通过")).toBeInTheDocument();

    rerender(
      <HarnessCanvasStoreProvider>
        <ConditionNode data={{ ...baseData, status: "fail" }} id="test" />
      </HarnessCanvasStoreProvider>
    );
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});
