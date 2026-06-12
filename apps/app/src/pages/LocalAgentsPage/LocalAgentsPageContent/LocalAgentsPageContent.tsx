import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Cpu, Radar, RefreshCw } from "lucide-react";
import { useCustomMutation, useList } from "@refinedev/core";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { PageLoadingState } from "@/components/PageLoadingState";
import { Icon } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { LocalAgentCard } from "../LocalAgentCard";

const SUPPORTED_RUNTIME_COUNT = 5;

export const LocalAgentsPageContent = () => {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const { result: runtimesResult, query: runtimesQuery } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const { mutateAsync: scanAndSync } = useCustomMutation();
  const runtimes = runtimesResult.data;
  const localRuntimes = runtimes.filter((runtime) => runtime.connection.mode === "local");

  const handleRescanButtonClick = async () => {
    setIsScanning(true);
    await scanAndSync({
      url: "agentRuntimes/scanAndSync",
      method: "post",
      values: {},
    });
    await runtimesQuery.refetch();
    setIsScanning(false);
  };

  if (runtimesQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("nav.items.localAgents")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button
            className="gap-1.5"
            disabled={isScanning}
            size="sm"
            variant="outline"
            onClick={handleRescanButtonClick}
          >
            <RefreshCw className={isScanning ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            {isScanning ? "Scanning..." : "Re-scan"}
          </Button>
        }
        eyebrow="Capabilities"
        icon={<Icon className="text-muted-foreground" icon={Cpu} size={18} />}
        sub="Workers detected on this machine - who Agent Bar can assemble into an executor right now. Not a roster."
        title="Local Agents"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
        {runtimes.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center text-muted-foreground">
            <Cpu className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-[13px] font-medium text-foreground">No local agents detected</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Re-scan this machine to sync available agent runtimes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {runtimes.map((runtime) => (
              <LocalAgentCard key={runtime.id} runtime={runtime} />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
          <Icon icon={Radar} size={14} />
          Auto-detected {localRuntimes.length} of {SUPPORTED_RUNTIME_COUNT} agent runtimes on{" "}
          <span className="font-mono">localhost</span>. Executors are assembled per-operation by the
          Agent Bar.
        </div>
      </div>
    </div>
  );
};
