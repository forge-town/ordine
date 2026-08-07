import { Loader2, Plug, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Connector, ConnectorMethod, ConnectorStatus } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dot, Tag } from "../../components/primitives";

export type ConnectorCardProps = {
  connector: Connector;
  isConnecting: boolean;
  onConnect: (connectorId: string) => void;
  onManage: (connector: Connector) => void;
};

const METHOD_LABELS: Record<ConnectorMethod, string> = {
  "built-in": "Built-in",
  "direct-api": "Direct API",
  mcp: "MCP",
};

const STATUS_TONES: Record<ConnectorStatus, "error" | "success" | "warning"> = {
  connected: "success",
  error: "error",
  needs_setup: "warning",
};

const getScopes = (connector: Connector) =>
  (connector.scopes ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

export const ConnectorCard = ({
  connector,
  isConnecting,
  onConnect,
  onManage,
}: ConnectorCardProps) => {
  const { t } = useTranslation();
  const scopes = getScopes(connector);
  const canTest = connector.method === "mcp";
  const handleConnectClick = () => onConnect(connector.id);
  const handleManageClick = () => onManage(connector);

  return (
    <article className="group flex min-h-[184px] flex-col rounded-lg bg-surface p-3.5 shadow-soft ring-1 ring-border transition-shadow hover:shadow-float hover:ring-border-strong">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <Plug className="size-3.5 text-foreground/75" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{connector.name}</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Dot ping={connector.status === "connected"} tone={STATUS_TONES[connector.status]} />
            {t(`connectors.status.${connector.status}`)}
          </div>
        </div>
        <Tag>{METHOD_LABELS[connector.method]}</Tag>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {scopes.length > 0 ? (
          scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)
        ) : (
          <span className="text-[11.5px] text-muted-foreground">{t("connectors.noScopes")}</span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border/70 pt-3">
        <div className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
          {canTest ? t("connectors.viaMcp") : t("connectors.noHandshake")}
        </div>
        {canTest ? (
          <Button
            className="h-7 gap-1.5 px-2 text-xs"
            disabled={isConnecting}
            size="sm"
            variant="outline"
            onClick={handleConnectClick}
          >
            {isConnecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plug className="size-3.5" />
            )}
            {t("connectors.test")}
          </Button>
        ) : null}
        <Button className="h-7 gap-1.5 px-2 text-xs" size="sm" onClick={handleManageClick}>
          <Settings2 className="size-3.5" />
          {t("connectors.manage")}
        </Button>
      </div>
    </article>
  );
};
