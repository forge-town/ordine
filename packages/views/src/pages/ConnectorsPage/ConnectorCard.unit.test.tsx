import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Connector } from "@repo/schemas";
import { render } from "../../test/test-wrapper";
import { ConnectorCard } from "./ConnectorCard";

const connector: Connector = {
  id: "connector-github",
  name: "GitHub",
  method: "mcp",
  status: "needs_setup",
  scopes: "repos, issues",
  config: { transport: "stdio", command: "github-mcp" },
  lastSyncAt: null,
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
};

describe("ConnectorCard", () => {
  it("exposes connection testing and connector management", async () => {
    const handleConnect = vi.fn();
    const handleManage = vi.fn();
    const user = userEvent.setup();
    render(
      <ConnectorCard
        connector={connector}
        isConnecting={false}
        onConnect={handleConnect}
        onManage={handleManage}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Test" }));
    await user.click(screen.getByRole("button", { name: "Manage" }));

    expect(handleConnect).toHaveBeenCalledWith(connector.id);
    expect(handleManage).toHaveBeenCalledWith(connector);
    expect(screen.getByText("repos")).toBeInTheDocument();
  });
});
