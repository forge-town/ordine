import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PipelinesPage } from "./PipelinesPage";

vi.mock("@/routes/_layout/pipelines.index", () => ({
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

describe("PipelinesPage", () => {
  it("renders without crashing", () => {
    render(<PipelinesPage />);
    expect(document.body).toBeTruthy();
  });
});
