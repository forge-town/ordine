import { Pencil, Play, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import type { Operation, OperationConfig, OperationConfigInput, OutputItem } from "@repo/schemas";
import { useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.index";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { useOperationDetailPageStore } from "../_store";
import { OutputItemsPanel } from "./OutputItemsPanel";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { OperationMetaPanel } from "./OperationMetaPanel";
import { OperationRunPanel } from "../OperationRunPanel";

const parseConfig = (raw: OperationConfigInput): OperationConfig => {
  return {
    executor: raw.executor,
    inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
    outputs: Array.isArray(raw.outputs)
      ? raw.outputs.map((o) => ({ ...o, templateIds: o.templateIds ?? [] }))
      : [],
  };
};

export const OperationDetailPageContent = () => {
  const { operationId } = Route.useParams();
  const { result: operationResult, query: operationQuery } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const operation = operationResult ?? null;
  const { t } = useTranslation();

  const store = useOperationDetailPageStore();
  const { selectedItemIndex, handleNavigateBack, handleNavigateToEdit, handleOpenRunPanel } =
    useStore(
      store,
      useShallow((s) => ({
        selectedItemIndex: s.selectedItemIndex,
        handleNavigateBack: s.handleNavigateBack,
        handleNavigateToEdit: s.handleNavigateToEdit,
        handleOpenRunPanel: s.handleOpenRunPanel,
      })),
    );

  const config = operation ? parseConfig(operation.config) : null;
  const selectedItem: OutputItem | undefined = config?.outputs[selectedItemIndex];

  if (operationQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("operations.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!operation || !config) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("operations.operationNotFound")}
        </p>
        <button className="text-xs text-primary hover:underline" onClick={handleNavigateBack}>
          {t("common.backToList")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button
              aria-label={t("operations.run.run", "Run")}
              size="sm"
              variant="default"
              onClick={handleOpenRunPanel}
            >
              <Play className="h-4 w-4" />
              {t("operations.run.run", "Run")}
            </Button>
            <Button
              aria-label={t("common.edit")}
              size="sm"
              variant="outline"
              onClick={handleNavigateToEdit.bind(null, operation.id)}
            >
              <Pencil className="h-4 w-4" />
              {t("common.edit")}
            </Button>
          </div>
        }
        backTo="/pipelines/operations"
        title={operation.name}
      />

      {/* Three-column body */}
      <div className="flex flex-1 overflow-hidden">
        <OutputItemsPanel outputs={config.outputs} />

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <ItemDetailPanel selectedItem={selectedItem} />
        </div>

        <OperationMetaPanel config={config} operation={operation} />
      </div>

      {/* Run panel */}
      <OperationRunPanel operationId={operation.id} operationName={operation.name} />
    </div>
  );
};
