import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

describe("OperationsPageContent - no native select elements", () => {
  it("does not render a native <select> for the sort control", () => {
    const { container } = render(
      <OperationsPageContent initialOperations={[]} />,
    );
    expect(container.querySelector('select[aria-label="排序"]')).toBeNull();
    expect(container.querySelector("select#sort-select")).toBeNull();
  });
});
