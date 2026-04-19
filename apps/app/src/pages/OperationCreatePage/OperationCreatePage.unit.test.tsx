import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { OperationCreatePage } from "./OperationCreatePage";

vi.mock("@/routes/_layout/operations.new", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn().mockResolvedValue({}),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    query: { isLoading: false },
  }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

describe("OperationCreatePage", () => {
  it("renders the create form", () => {
    render(<OperationCreatePage />);
    expect(screen.getByPlaceholderText(/e.g. Run ESLint/i)).toBeInTheDocument();
  });
});
