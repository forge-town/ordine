import { useMemo, useState, type ChangeEvent } from "react";
import { Plus, Plug } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { useCreate, useDataProvider, useList, useUpdate } from "@refinedev/core";
import {
  isMcpConnectorConfig,
  type Connector,
  type ConnectorConfig,
  type ConnectorMethod,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { ResourceName } from "../../constants";
import { PageHeader } from "../../components/PageHeader";
import { PageLoadingState } from "../../components/PageLoadingState";
import { ConnectorCard } from "./ConnectorCard";

type ConnectorFilter = "all" | "connected" | "needs_setup" | "mcp";
type ConnectorTransport = "stdio" | "http";

type ConnectorFormState = {
  args: string;
  command: string;
  method: ConnectorMethod;
  name: string;
  scopes: string;
  transport: ConnectorTransport;
  url: string;
};

const CONNECTOR_FILTERS: ConnectorFilter[] = ["all", "connected", "needs_setup", "mcp"];

const EMPTY_FORM: ConnectorFormState = {
  args: "",
  command: "",
  method: "mcp",
  name: "",
  scopes: "",
  transport: "stdio",
  url: "",
};

const toFormState = (connector: Connector): ConnectorFormState => {
  const config = connector.config;
  const mcpConfig = isMcpConnectorConfig(config) ? config : null;

  return {
    args: mcpConfig?.transport === "stdio" ? (mcpConfig.args ?? []).join(" ") : "",
    command: mcpConfig?.transport === "stdio" ? mcpConfig.command : "",
    method: connector.method,
    name: connector.name,
    scopes: connector.scopes ?? "",
    transport: mcpConfig?.transport ?? "stdio",
    url: mcpConfig?.transport === "http" ? mcpConfig.url : "",
  };
};

const toConnectorConfig = (
  form: ConnectorFormState,
  currentConfig?: ConnectorConfig,
): ConnectorConfig => {
  if (form.method !== "mcp") return {};
  const current =
    currentConfig &&
    isMcpConnectorConfig(currentConfig) &&
    currentConfig.transport === form.transport
      ? currentConfig
      : null;
  if (form.transport === "http") {
    return {
      ...(current?.transport === "http" && current.headers ? { headers: current.headers } : {}),
      transport: "http",
      url: form.url.trim(),
    };
  }

  const args = form.args.split(/\s+/).filter(Boolean);

  return {
    ...(current?.transport === "stdio" && current.env ? { env: current.env } : {}),
    transport: "stdio",
    command: form.command.trim(),
    ...(args.length > 0 ? { args } : {}),
  };
};

const matchesFilter = (connector: Connector, filter: ConnectorFilter) => {
  if (filter === "connected") return connector.status === "connected";
  if (filter === "needs_setup") return connector.status === "needs_setup";
  if (filter === "mcp") return connector.method === "mcp";

  return true;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error("Connector request failed");

export const ConnectorsPageContent = () => {
  const { t } = useTranslation();
  const { result: connectorsResult, query: connectorsQuery } = useList<Connector>({
    resource: ResourceName.connectors,
  });
  const getDataProvider = useDataProvider();
  const { mutateAsync: createConnector } = useCreate();
  const { mutateAsync: updateConnector } = useUpdate();
  const connectors = connectorsResult.data;
  const [filter, setFilter] = useState<ConnectorFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [form, setForm] = useState<ConnectorFormState>(EMPTY_FORM);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionFailed, setConnectionFailed] = useState(false);

  const filteredConnectors = useMemo(
    () => connectors.filter((connector) => matchesFilter(connector, filter)),
    [connectors, filter],
  );
  const formReady =
    form.name.trim().length > 0 &&
    (form.method !== "mcp" ||
      (form.transport === "stdio"
        ? form.command.trim().length > 0
        : /^https?:\/\//.test(form.url)));

  const handleAddConnectorClick = () => {
    setEditingConnector(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleManageConnector = (connector: Connector) => {
    setEditingConnector(connector);
    setForm(toFormState(connector));
    setDialogOpen(true);
  };

  const handleFilterButtonClick = (nextFilter: ConnectorFilter) => () => setFilter(nextFilter);
  const handleDialogOpenChange = (open: boolean) => setDialogOpen(open);
  const handleDialogCancelClick = () => setDialogOpen(false);

  const handleConnectConnector = async (connectorId: string) => {
    setConnectingId(connectorId);
    setConnectionMessage(null);
    const dataProvider = getDataProvider();
    const result = await ResultAsync.fromPromise(
      dataProvider.custom!<Connector>({
        method: "post",
        payload: { id: connectorId },
        url: "connectors/connect",
      }),
      toError,
    );

    if (result.isErr()) {
      setConnectionFailed(true);
      setConnectionMessage(result.error.message);
    } else {
      setConnectionFailed(false);
      setConnectionMessage(t("connectors.testSuccess"));
    }
    await connectorsQuery.refetch();
    setConnectingId(null);
  };

  const handleSaveConnectorClick = async () => {
    const commonValues = {
      name: form.name.trim(),
      scopes: form.scopes.trim() || null,
    };

    if (editingConnector) {
      const initialForm = toFormState(editingConnector);
      const methodChanged = form.method !== editingConnector.method;
      const configChanged =
        methodChanged ||
        form.transport !== initialForm.transport ||
        form.command.trim() !== initialForm.command.trim() ||
        form.args.trim() !== initialForm.args.trim() ||
        form.url.trim() !== initialForm.url.trim();
      const values = {
        ...commonValues,
        ...(methodChanged ? { method: form.method } : {}),
        ...(configChanged ? { config: toConnectorConfig(form, editingConnector.config) } : {}),
      };

      await updateConnector({
        resource: ResourceName.connectors,
        id: editingConnector.id,
        values,
      });
    } else {
      await createConnector({
        resource: ResourceName.connectors,
        values: {
          ...commonValues,
          config: toConnectorConfig(form),
          method: form.method,
          status: "needs_setup" as const,
        },
      });
    }

    await connectorsQuery.refetch();
    setDialogOpen(false);
    setEditingConnector(null);
    setForm(EMPTY_FORM);
  };

  const handleFieldChange =
    (field: keyof ConnectorFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  if (connectorsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow={t("nav.groups.capabilities")}
          icon={<Plug className="size-[18px] text-muted-foreground" />}
          sub={t("connectors.subtitle")}
          title={t("connectors.title")}
        />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button className="gap-1.5" size="sm" onClick={handleAddConnectorClick}>
            <Plus className="size-4" />
            {t("connectors.add")}
          </Button>
        }
        badge={<span className="text-xs text-muted-foreground">{connectors.length}</span>}
        eyebrow={t("nav.groups.capabilities")}
        icon={<Plug className="size-[18px] text-muted-foreground" />}
        sub={t("connectors.subtitle")}
        title={t("connectors.title")}
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-4 py-3 sm:px-6">
        {CONNECTOR_FILTERS.map((nextFilter) => (
          <Button
            key={nextFilter}
            className="h-7 px-2.5 text-xs"
            size="sm"
            variant={filter === nextFilter ? "default" : "ghost"}
            onClick={handleFilterButtonClick(nextFilter)}
          >
            {t(`connectors.filters.${nextFilter}`)}
          </Button>
        ))}
      </div>

      {connectionMessage ? (
        <div
          className={
            connectionFailed
              ? "border-b border-destructive/20 bg-destructive/5 px-6 py-2 text-xs text-destructive"
              : "border-b border-success/20 bg-success/5 px-6 py-2 text-xs text-success"
          }
          role="status"
        >
          {connectionMessage}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {filteredConnectors.length === 0 ? (
          <div className="grid place-items-center rounded-lg bg-surface-2/50 py-16 text-center text-muted-foreground">
            <Plug className="size-8 text-muted-foreground/30" />
            <p className="mt-2 text-[13px] font-medium text-foreground">{t("connectors.empty")}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {t("connectors.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredConnectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                isConnecting={connectingId === connector.id}
                onConnect={handleConnectConnector}
                onManage={handleManageConnector}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingConnector ? t("connectors.manage") : t("connectors.add")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block text-xs font-medium">
              {t("common.name")}
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="notion-mcp"
                value={form.name}
                onChange={handleFieldChange("name")}
              />
            </label>
            <label className="block text-xs font-medium">
              {t("connectors.method")}
              <select
                className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={form.method}
                onChange={handleFieldChange("method")}
              >
                <option value="mcp">MCP</option>
                <option value="direct-api">Direct API</option>
                <option value="built-in">Built-in</option>
              </select>
            </label>
            {form.method === "mcp" ? (
              <>
                <label className="block text-xs font-medium">
                  {t("connectors.transport")}
                  <select
                    className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                    value={form.transport}
                    onChange={handleFieldChange("transport")}
                  >
                    <option value="stdio">stdio</option>
                    <option value="http">HTTP / SSE</option>
                  </select>
                </label>
                {form.transport === "stdio" ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <label className="block text-xs font-medium">
                      {t("connectors.command")}
                      <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="npx"
                        value={form.command}
                        onChange={handleFieldChange("command")}
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      {t("connectors.args")}
                      <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="-y @server/pkg"
                        value={form.args}
                        onChange={handleFieldChange("args")}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block text-xs font-medium">
                    URL
                    <Input
                      className="mt-1 h-8 text-sm"
                      placeholder="https://mcp.example.com"
                      value={form.url}
                      onChange={handleFieldChange("url")}
                    />
                  </label>
                )}
              </>
            ) : null}
            <label className="block text-xs font-medium">
              {t("connectors.scopes")}
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="repo, issues, files"
                value={form.scopes}
                onChange={handleFieldChange("scopes")}
              />
            </label>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={handleDialogCancelClick}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!formReady} size="sm" onClick={handleSaveConnectorClick}>
              {editingConnector ? t("common.save") : t("connectors.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
