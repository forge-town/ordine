import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelinesPage } from "./PipelinesPage";

vi.mock("@/routes/pipelines.index", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/pipelinesService", () => ({
  createPipeline: vi.fn().mockResolvedValue({ id: "new-pipe" }),
  deletePipeline: vi.fn().mockResolvedValue({}),
}));

describe("PipelinesPage", () => {
  it("renders inside AppLayout", () => {
    render(<PipelinesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
