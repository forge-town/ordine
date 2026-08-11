import type { Meta, StoryObj } from "@storybook/react";
import type { Connector } from "@repo/schemas";
import { ConnectorCard } from "./ConnectorCard";

const connectorDate = new Date("2026-08-11T08:00:00.000Z");

const mcpConnector: Connector = {
  id: "connector-github",
  name: "GitHub MCP",
  method: "mcp",
  status: "connected",
  scopes: "repos, issues, pull requests",
  config: {
    transport: "stdio",
    command: "github-mcp",
    tools: [{ name: "search_repositories" }],
  },
  lastSyncAt: connectorDate,
  createdAt: connectorDate,
  updatedAt: connectorDate,
};

const meta = {
  title: "Pages/ConnectorsPage/ConnectorCard",
  component: ConnectorCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
  args: {
    connector: mcpConnector,
    isConnecting: false,
    onConnect: () => undefined,
    onManage: () => undefined,
  },
} satisfies Meta<typeof ConnectorCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConnectedMcp: Story = {};

export const ConnectingMcp: Story = {
  args: { isConnecting: true },
};

export const ErrorMcp: Story = {
  args: {
    connector: {
      ...mcpConnector,
      id: "connector-postgres",
      name: "Postgres MCP",
      status: "error",
      scopes: "schema, query",
      config: {
        transport: "stdio",
        command: "postgres-mcp",
        lastError: "Connection refused",
      },
      lastSyncAt: null,
    },
  },
};

export const DirectApiNeedsSetup: Story = {
  args: {
    connector: {
      ...mcpConnector,
      id: "connector-slack",
      name: "Slack",
      method: "direct-api",
      status: "needs_setup",
      scopes: "channels, messages",
      config: {},
      lastSyncAt: null,
    },
  },
};
