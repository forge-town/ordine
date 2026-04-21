import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { JobsPage } from "./JobsPage";

vi.mock("@/routes/_layout/jobs.index", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/jobsService", () => ({
  deleteJob: vi.fn().mockResolvedValue(undefined),
}));

describe("JobsPage", () => {
  it("renders Jobs 监控 header", () => {
    render(<JobsPage />);
    expect(screen.getByText("Jobs 监控")).toBeInTheDocument();
  });
});
