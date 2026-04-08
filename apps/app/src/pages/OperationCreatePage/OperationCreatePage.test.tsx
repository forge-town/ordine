import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("OperationCreatePage", () => {
  it("renders the create form", () => {
    render(<OperationCreatePage />);
    expect(screen.getByPlaceholderText(/e.g. Run ESLint/i)).toBeInTheDocument();
  });
});
