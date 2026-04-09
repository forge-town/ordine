import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { FolderNode } from "./FolderNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
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
  nodeType: "folder" as const,
  label: "src",
  folderPath: "apps/app/src",
  description: "应用源码目录",
};

describe("FolderNode", () => {
  it("renders label", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("src")).toBeInTheDocument();
  });

  it("renders folderPath", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("apps/app/src")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("应用源码目录")).toBeInTheDocument();
  });

  it("shows placeholder when folderPath is empty", () => {
    render(<FolderNode data={{ ...baseData, folderPath: "" }} id="test" />, {
      wrapper,
    });
    expect(screen.getByPlaceholderText("src/components/")).toBeInTheDocument();
  });
});
