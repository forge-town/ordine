import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { GitHubProjectNode } from "./GitHubProjectNode";

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
    render(<GitHubProjectNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByDisplayValue("ordine")).toBeInTheDocument();
  });

  it("renders owner/repo combined", () => {
    render(<GitHubProjectNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText(/amin.*ordine/)).toBeInTheDocument();
  });

  it("renders branch badge", () => {
    render(<GitHubProjectNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<GitHubProjectNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("主项目仓库")).toBeInTheDocument();
  });

  it("shows connect button when owner and repo are empty", () => {
    render(
      <GitHubProjectNode
        id="test"
        data={{ ...baseData, owner: "", repo: "" }}
      />,
      { wrapper },
    );
    expect(screen.getByText("从项目库选取")).toBeInTheDocument();
  });
});
