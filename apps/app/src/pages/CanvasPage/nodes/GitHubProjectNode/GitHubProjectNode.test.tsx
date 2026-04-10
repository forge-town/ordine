import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { GitHubProjectNode } from "./GitHubProjectNode";

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
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "github-project" as const,
  label: "ordine",
  owner: "amin",
  repo: "ordine",
  branch: "main",
  description: "主项目仓库",
};

describe("GitHubProjectNode", () => {
  it("renders label input", () => {
    render(<GitHubProjectNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("ordine")).toBeInTheDocument();
  });

  it("renders owner/repo combined", () => {
    render(<GitHubProjectNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText(/amin.*ordine/)).toBeInTheDocument();
  });

  it("renders branch badge", () => {
    render(<GitHubProjectNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<GitHubProjectNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByText("主项目仓库")).toBeInTheDocument();
  });

  it("shows connect button when owner and repo are empty", () => {
    render(
      <GitHubProjectNode
        data={{ ...baseData, owner: "", repo: "" }}
        id="test"
      />,
      {
        wrapper,
      },
    );
    expect(screen.getByText("从项目库选取")).toBeInTheDocument();
  });

  it("shows select local folder button when disconnected", () => {
    render(
      <GitHubProjectNode
        data={{ ...baseData, owner: "", repo: "" }}
        id="test"
      />,
      {
        wrapper,
      },
    );
    expect(screen.getByText("选择本地文件夹")).toBeInTheDocument();
  });

  it("renders local path when sourceType is local", () => {
    const localData = {
      nodeType: "github-project" as const,
      label: "my-local-project",
      owner: "",
      repo: "",
      sourceType: "local" as const,
      localPath: "/Users/amin/projects/my-app",
    };
    render(<GitHubProjectNode data={localData} id="test" />, { wrapper });
    expect(screen.getByText("/Users/amin/projects/my-app")).toBeInTheDocument();
  });
});
