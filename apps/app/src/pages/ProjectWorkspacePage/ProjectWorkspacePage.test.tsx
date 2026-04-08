import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

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

describe("ProjectWorkspacePage", () => {
  it("renders inside AppLayout", () => {
    render(<ProjectWorkspacePage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
