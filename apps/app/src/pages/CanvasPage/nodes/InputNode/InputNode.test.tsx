import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { InputNode } from "./InputNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "input" as const,
  label: "用户输入",
  contextDescription: "来自用户的请求信息",
  exampleValue: '{ "query": "hello" }',
};

describe("InputNode", () => {
  it("renders label", () => {
    render(<InputNode id="1" data={baseData} />, { wrapper });
    expect(screen.getByText("用户输入")).toBeInTheDocument();
  });

  it("renders contextDescription", () => {
    render(<InputNode id="1" data={baseData} />, { wrapper });
    expect(screen.getByText("来自用户的请求信息")).toBeInTheDocument();
  });

  it("renders exampleValue when provided", () => {
    render(<InputNode id="1" data={baseData} />, { wrapper });
    expect(screen.getByText('{ "query": "hello" }')).toBeInTheDocument();
  });

  it("does not render exampleValue pill when absent", () => {
    render(
      <InputNode id="1" data={{ ...baseData, exampleValue: undefined }} />,
      { wrapper },
    );
    expect(screen.queryByText(/query/)).not.toBeInTheDocument();
  });
});
