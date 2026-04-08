import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/routes/projects.$projectId", () => ({
  Route: {
    useLoaderData: () => ({ project: null, works: [], pipelines: [] }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ProjectDetailPage", () => {
  it("renders inside AppLayout", () => {
    render(<ProjectDetailPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
