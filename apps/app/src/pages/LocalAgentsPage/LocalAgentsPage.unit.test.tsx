import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalAgentsPage } from "./LocalAgentsPage";

const mockRefetch = vi.fn();
const mockScanAndSync = vi.fn();
const mockData = {
  runtimes: [
    {
      id: "local-codex",
      name: "Codex",
      type: "codex",
      connection: { mode: "local" },
    },
  ],
};

vi.mock("@refinedev/core", () => ({
  useCustomMutation: () => ({ mutateAsync: mockScanAndSync }),
  useList: () => ({
    result: { data: mockData.runtimes },
    query: { isLoading: false, refetch: mockRefetch },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockScanAndSync.mockResolvedValue({});
  mockRefetch.mockResolvedValue({});
});

describe("LocalAgentsPage", () => {
  it("renders local agent cards and info bar", () => {
    render(<LocalAgentsPage />);

    expect(screen.getByText("Local Agents")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("OpenAI coding models")).toBeInTheDocument();
    expect(screen.getByText(/Auto-detected 1 of 5/)).toBeInTheDocument();
  });

  it("rescans and refetches runtimes", async () => {
    const user = userEvent.setup();
    render(<LocalAgentsPage />);

    await user.click(screen.getByRole("button", { name: "Re-scan" }));

    expect(mockScanAndSync).toHaveBeenCalledWith({
      url: "agentRuntimes/scanAndSync",
      method: "post",
      values: {},
    });
    expect(mockRefetch).toHaveBeenCalled();
  });
});
