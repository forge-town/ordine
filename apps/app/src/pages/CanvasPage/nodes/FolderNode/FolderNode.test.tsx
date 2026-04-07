import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { FolderNode } from "./FolderNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
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
    expect(screen.getByText("src")).toBeInTheDocument();
  });

  it("renders folderPath", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText("apps/app/src")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<FolderNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText("应用源码目录")).toBeInTheDocument();
  });

  it("shows placeholder when folderPath is empty", () => {
    render(<FolderNode data={{ ...baseData, folderPath: "" }} id="test" />, { wrapper });
    expect(screen.getByText("未设置路径")).toBeInTheDocument();
  });
});
