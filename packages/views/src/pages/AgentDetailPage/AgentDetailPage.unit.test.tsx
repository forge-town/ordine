import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../test/test-wrapper";
import { AgentDetailPage } from "./AgentDetailPage";

const mockRefetch = vi.fn();
const mockUseOne = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@refinedev/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@refinedev/core")>();

  return {
    ...original,
    useDelete: () => ({ mutateAsync: vi.fn() }),
    useOne: (...args: unknown[]) => mockUseOne(...args),
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: React.PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({ agentId: "agent-missing" }),
}));

describe("AgentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a retryable network error instead of a permanent skeleton", () => {
    mockUseOne.mockReturnValue({
      result: undefined,
      query: { isError: true, isLoading: false, refetch: mockRefetch },
    });

    render(<AgentDetailPage />);

    expect(screen.getByText("common.loadFailed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });

  it("distinguishes a missing Agent from a network failure", () => {
    mockUseOne.mockReturnValue({
      result: undefined,
      query: { isError: false, isLoading: false, refetch: mockRefetch },
    });

    render(<AgentDetailPage />);

    expect(screen.getByText("common.notFound")).toBeInTheDocument();
    expect(screen.getByText("agents.notFoundDescription")).toBeInTheDocument();
  });
});
