import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { JobsPage } from "./JobsPage";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: [] }, query: { isLoading: false } }),
  useUpdate: () => ({ mutate: vi.fn() }),
}));

describe("JobsPage", () => {
  it("renders Jobs header", () => {
    render(<JobsPage />);
    expect(screen.getByText("Jobs")).toBeInTheDocument();
  });
});
