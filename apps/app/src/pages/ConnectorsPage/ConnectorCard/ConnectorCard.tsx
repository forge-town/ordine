import { Plug, Settings2 } from "lucide-react";
import type { Connector, ConnectorMethod, ConnectorStatus } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dot, Icon, Tag } from "@/components/primitives";

export type ConnectorCardProps = {
  connector: Connector;
  onConnect: (connectorId: string) => void;
  onManage: (connector: Connector) => void;
};

const METHOD_LABELS: Record<ConnectorMethod, string> = {
  "built-in": "Built-in",
  "direct-api": "Direct API",
  mcp: "MCP",
};

const STATUS_LABELS: Record<ConnectorStatus, string> = {
  connected: "Connected",
  error: "Error",
  needs_setup: "Needs setup",
};

const STATUS_TONES: Record<ConnectorStatus, "error" | "success" | "warning"> = {
  connected: "success",
  error: "error",
  needs_setup: "warning",
};

const getScopes = (connector: Connector) => {
  return (connector.scopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
};

export const ConnectorCard = ({ connector, onConnect, onManage }: ConnectorCardProps) => {
  const scopes = getScopes(connector);
  const handleConnectClick = () => onConnect(connector.id);
  const handleManageClick = () => onManage(connector);

  return (
    <div className="group flex min-h-[184px] flex-col rounded-lg bg-surface p-3.5 ring-1 ring-border shadow-soft transition-all hover:shadow-float hover:ring-border-strong">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Icon className="text-foreground/75" icon={Plug} size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold tracking-tightish">
            {connector.name}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Dot ping={connector.status === "connected"} tone={STATUS_TONES[connector.status]} />
            {STATUS_LABELS[connector.status]}
          </div>
        </div>
        <Tag>{METHOD_LABELS[connector.method]}</Tag>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {scopes.length > 0 ? (
          scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)
        ) : (
          <span className="text-[11.5px] text-muted-foreground">No scopes requested</span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border/70 pt-3">
        <div className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
          {connector.method === "mcp" ? "via MCP server" : "direct workspace connector"}
        </div>
        <Button
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={connector.status === "connected"}
          size="sm"
          variant="outline"
          onClick={handleConnectClick}
        >
          <Plug className="h-3.5 w-3.5" />
          Connect
        </Button>
        <Button className="h-7 gap-1.5 px-2 text-xs" size="sm" onClick={handleManageClick}>
          <Settings2 className="h-3.5 w-3.5" />
          Manage
        </Button>
      </div>
    </div>
  );
};
