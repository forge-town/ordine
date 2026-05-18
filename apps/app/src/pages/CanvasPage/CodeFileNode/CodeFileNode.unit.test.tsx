import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../_store";
import { FileNode } from "./CodeFileNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "test",
  useUpdateNodeInternals: () => () => undefined,
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    query: {
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "file" as const,
  label: "main.ts",
  filePath: "src/main.ts",
  language: "typescript",
  description: "应用入口文件",
};

describe("CodeFileNode", () => {
  it("renders label", () => {
    render(<FileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("main.ts")).toBeInTheDocument();
  });

  it("renders filePath", () => {
    render(<FileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("src/main.ts")).toBeInTheDocument();
  });

  it("renders language badge", () => {
    render(<FileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("typescript")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<FileNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("应用入口文件")).toBeInTheDocument();
  });

  it("shows placeholder when filePath is empty", () => {
    render(<FileNode data={{ ...baseData, filePath: "" }} id="test" />, {
      wrapper,
    });
    expect(screen.getByPlaceholderText("src/file.tsx")).toBeInTheDocument();
  });
});
