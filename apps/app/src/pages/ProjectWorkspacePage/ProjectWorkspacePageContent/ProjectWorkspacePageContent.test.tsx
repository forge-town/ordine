import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectWorkspacePageContent } from "./ProjectWorkspacePageContent";

vi.mock("@/routes/projects.$projectId.workspace", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/worksService", () => ({
  createWork: vi.fn().mockResolvedValue({}),
}));

describe("ProjectWorkspacePageContent", () => {
  it("shows not found when project is null", () => {
    render(<ProjectWorkspacePageContent />);
    expect(screen.getByText("项目不存在")).toBeInTheDocument();
  });
});
