import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CodeFileNode } from "./CodeFileNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
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
    render(<CodeFileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("main.ts")).toBeInTheDocument();
  });

  it("renders filePath", () => {
    render(<CodeFileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("src/main.ts")).toBeInTheDocument();
  });

  it("renders language badge", () => {
    render(<CodeFileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("typescript")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<CodeFileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("应用入口文件")).toBeInTheDocument();
  });

  it("shows placeholder when filePath is empty", () => {
    render(<CodeFileNode data={{ ...baseData, filePath: "" }} id="test" />, {
      wrapper,
    });
    expect(screen.getByPlaceholderText("src/file.tsx")).toBeInTheDocument();
  });
});
