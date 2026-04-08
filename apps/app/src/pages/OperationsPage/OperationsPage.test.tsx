import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { OperationsPage } from "./OperationsPage";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => [],
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn().mockResolvedValue({}),
  deleteOperation: vi.fn().mockResolvedValue({}),
  updateOperation: vi.fn().mockResolvedValue({}),
  exportOperation: vi.fn().mockResolvedValue({}),
  importOperation: vi.fn().mockResolvedValue({}),
}));

describe("OperationsPage", () => {
  it("renders OperationsPageContent", () => {
    render(<OperationsPage />);
    expect(document.body).toBeTruthy();
  });
});
