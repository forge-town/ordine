import { useTranslation } from "react-i18next";
import { useMemo, useState, type ChangeEvent } from "react";
import { Plus, Plug } from "lucide-react";
import { useCreate, useList, useUpdate } from "@refinedev/core";
import type { Connector, ConnectorMethod, ConnectorStatus } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { PageLoadingState } from "@/components/PageLoadingState";
import { Icon } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { ConnectorCard } from "../ConnectorCard";

type ConnectorFilter = "All" | "Connected" | "Needs setup" | "via MCP";

type ConnectorFormState = {
  method: ConnectorMethod;
  name: string;
  scopes: string;
  status: ConnectorStatus;
};

const CONNECTOR_FILTERS: ConnectorFilter[] = ["All", "Connected", "Needs setup", "via MCP"];

const METHOD_OPTIONS: { label: string; value: ConnectorMethod }[] = [
  { label: "MCP", value: "mcp" },
  { label: "Direct API", value: "direct-api" },
  { label: "Built-in", value: "built-in" },
];

const STATUS_OPTIONS: { label: string; value: ConnectorStatus }[] = [
  { label: "Connected", value: "connected" },
  { label: "Needs setup", value: "needs_setup" },
  { label: "Error", value: "error" },
];

const EMPTY_FORM: ConnectorFormState = {
  method: "mcp",
  name: "",
  scopes: "",
  status: "needs_setup",
};

const toFormState = (connector: Connector): ConnectorFormState => ({
  method: connector.method,
  name: connector.name,
  scopes: connector.scopes ?? "",
  status: connector.status,
});

const matchesFilter = (connector: Connector, filter: ConnectorFilter) => {
  if (filter === "Connected") return connector.status === "connected";
  if (filter === "Needs setup") return connector.status === "needs_setup";
  if (filter === "via MCP") return connector.method === "mcp";

  return true;
};

export const ConnectorsPageContent = () => {
  const { t } = useTranslation();
  const { result: connectorsResult, query: connectorsQuery } = useList<Connector>({
    resource: ResourceName.connectors,
  });
  const { mutateAsync: createConnector } = useCreate();
  const { mutateAsync: updateConnector } = useUpdate();
  const connectors = connectorsResult.data;
  const [filter, setFilter] = useState<ConnectorFilter>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [form, setForm] = useState<ConnectorFormState>(EMPTY_FORM);

  const filteredConnectors = useMemo(() => {
    return connectors.filter((connector) => matchesFilter(connector, filter));
  }, [connectors, filter]);

  const handleAddConnectorClick = () => {
    setEditingConnector(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
  };

  const handleFilterClick = (nextFilter: ConnectorFilter) => {
    setFilter(nextFilter);
  };

  const handleDialogCancelClick = () => {
    setDialogOpen(false);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, name: event.target.value }));
  };

  const handleScopesChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, scopes: event.target.value }));
  };

  const handleMethodChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setForm((current) => ({ ...current, method: event.target.value as ConnectorMethod }));
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setForm((current) => ({ ...current, status: event.target.value as ConnectorStatus }));
  };

  const handleManageConnector = (connector: Connector) => {
    setEditingConnector(connector);
    setForm(toFormState(connector));
    setDialogOpen(true);
  };

  const handleConnectConnector = async (connectorId: string) => {
    await updateConnector({
      resource: ResourceName.connectors,
      id: connectorId,
      values: { status: "connected" },
    });
    await connectorsQuery.refetch();
  };

  const handleSaveConnectorClick = async () => {
    const values = {
      config: editingConnector?.config ?? {},
      method: form.method,
      name: form.name.trim(),
      scopes: form.scopes.trim() || null,
      status: form.status,
    };

    if (editingConnector) {
      await updateConnector({
        resource: ResourceName.connectors,
        id: editingConnector.id,
        values,
      });
    } else {
      await createConnector({
        resource: ResourceName.connectors,
        values,
      });
    }

    await connectorsQuery.refetch();
    setDialogOpen(false);
    setEditingConnector(null);
    setForm(EMPTY_FORM);
  };

  if (connectorsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("nav.items.connectors")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button className="gap-1.5" size="sm" onClick={handleAddConnectorClick}>
            <Plus className="h-4 w-4" />
            Add Connector
          </Button>
        }
        badge={<span className="text-xs text-muted-foreground">{connectors.length}</span>}
        eyebrow="Capabilities"
        icon={<Icon className="text-muted-foreground" icon={Plug} size={18} />}
        sub="External tool, API, and repository connections available to agents."
        title="Connectors"
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-6 py-3">
        {CONNECTOR_FILTERS.map((nextFilter) => (
          <Button
            key={nextFilter}
            className="h-7 px-2.5 text-xs"
            size="sm"
            variant={filter === nextFilter ? "default" : "ghost"}
            onClick={() => handleFilterClick(nextFilter)}
          >
            {nextFilter}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8 pt-4">
        {filteredConnectors.length === 0 ? (
          <div className="grid place-items-center rounded-lg bg-surface-2/50 py-16 text-center text-muted-foreground">
            <Plug className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-[13px] font-medium text-foreground">No connectors found</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Add a connector to expose tools and external systems to local agents.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filteredConnectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
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
            <DialogTitle>{editingConnector ? "Manage Connector" : "Add Connector"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="notion-mcp"
                value={form.name}
                onChange={handleNameChange}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Method</label>
              <select
                className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={form.method}
                onChange={handleMethodChange}
              >
                {METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Scopes</label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="repo, issues, files"
                value={form.scopes}
                onChange={handleScopesChange}
              />
            </div>
            {editingConnector ? (
              <div>
                <label className="text-xs font-medium">Status</label>
                <select
                  className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={form.status}
                  onChange={handleStatusChange}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={handleDialogCancelClick}>
              Cancel
            </Button>
            <Button disabled={!form.name.trim()} size="sm" onClick={handleSaveConnectorClick}>
              {editingConnector ? "Save" : "Add Connector"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
