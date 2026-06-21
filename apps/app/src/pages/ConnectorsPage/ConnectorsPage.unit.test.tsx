import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Connector } from "@repo/schemas";
import { render } from "@/test/test-wrapper";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { ConnectorsPage } from "./ConnectorsPage";

const mockRefetch = vi.fn();
const mockCreateConnector = vi.fn();
const mockUpdateConnector = vi.fn();
const mockData: { connectors: Connector[] } = {
  connectors: [],
};

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mockCreateConnector }),
  useList: () => ({
    result: { data: mockData.connectors },
    query: { isLoading: false, refetch: mockRefetch },
  }),
  useUpdate: () => ({ mutateAsync: mockUpdateConnector }),
}));

const now = new Date("2026-06-10T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateConnector.mockResolvedValue({});
  mockUpdateConnector.mockResolvedValue({});
  mockRefetch.mockResolvedValue({});
  mockData.connectors = [
    {
      id: "connector-github",
      name: "GitHub",
      method: "direct-api",
      status: "connected",
      scopes: "repo, issues",
      config: {},
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "connector-notion",
      name: "Notion MCP",
      method: "mcp",
      status: "needs_setup",
      scopes: "pages, databases",
      config: {},
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
});

describe("ConnectorsPage", () => {
  it("renders connector cards and filters by setup status", async () => {
    const user = userEvent.setup();
    render(<ConnectorsPage />);

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Direct API")).toBeInTheDocument();
    expect(screen.getByText("repo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Needs setup" }));

    expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
    expect(screen.getByText("Notion MCP")).toBeInTheDocument();
    expect(screen.getByText("via MCP server")).toBeInTheDocument();
  });

  it("connects a connector from the card action", async () => {
    const user = userEvent.setup();
    render(<ConnectorsPage />);

    await user.click(screen.getByRole("button", { name: "Needs setup" }));
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(mockUpdateConnector).toHaveBeenCalledWith({
      resource: ResourceName.connectors,
      id: "connector-notion",
      values: { status: "connected" },
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("creates a connector from the add dialog", async () => {
    const user = userEvent.setup();
    render(<ConnectorsPage />);

    await user.click(screen.getByRole("button", { name: "Add Connector" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("notion-mcp"), "Linear MCP");
    await user.selectOptions(within(dialog).getByDisplayValue("MCP"), "mcp");
    await user.type(within(dialog).getByPlaceholderText("repo, issues, files"), "issues, teams");
    await user.click(within(dialog).getByRole("button", { name: "Add Connector" }));

    expect(mockCreateConnector).toHaveBeenCalledWith({
      resource: ResourceName.connectors,
      values: {
        config: {},
        method: "mcp",
        name: "Linear MCP",
        scopes: "issues, teams",
        status: "needs_setup",
      },
    });
    expect(mockRefetch).toHaveBeenCalled();
  });
});
