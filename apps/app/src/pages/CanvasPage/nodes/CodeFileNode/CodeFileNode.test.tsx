import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CodeFileNode } from "./CodeFileNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "code-file" as const,
  label: "main.ts",
  filePath: "src/main.ts",
  language: "typescript",
  description: "应用入口文件",
};

describe("CodeFileNode", () => {
  it("renders label", () => {
    render(<CodeFileNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("main.ts")).toBeInTheDocument();
  });

  it("renders filePath", () => {
    render(<CodeFileNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  it("renders language badge", () => {
    render(<CodeFileNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<CodeFileNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("应用入口文件")).toBeInTheDocument();
  });

  it("shows placeholder when filePath is empty", () => {
    render(<CodeFileNode id="test" data={{ ...baseData, filePath: "" }} />, { wrapper });
    expect(screen.getByText("未设置路径")).toBeInTheDocument();
  });
});
