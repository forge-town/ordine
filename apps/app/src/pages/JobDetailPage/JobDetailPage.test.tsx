import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPage } from "./JobDetailPage";

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useLoaderData: () => null },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("JobDetailPage", () => {
  it("renders null state when no job", () => {
    render(<JobDetailPage />);
    expect(screen.getByText("Job 不存在")).toBeInTheDocument();
  });
});
