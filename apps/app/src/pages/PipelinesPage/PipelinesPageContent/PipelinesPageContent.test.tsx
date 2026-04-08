import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelinesPageContent } from "./PipelinesPageContent";

vi.mock("@/routes/pipelines.index", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/pipelinesService", () => ({
  createPipeline: vi.fn().mockResolvedValue({ id: "new-pipe" }),
  deletePipeline: vi.fn().mockResolvedValue({}),
}));

describe("PipelinesPageContent", () => {
  it("renders with no pipelines", () => {
    render(<PipelinesPageContent />);
    expect(screen.getByText(/Pipeline|pipeline/i)).toBeInTheDocument();
  });
});
