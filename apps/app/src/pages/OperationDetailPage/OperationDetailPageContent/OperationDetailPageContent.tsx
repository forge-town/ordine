import { useNavigate } from "@tanstack/react-router";
import { Pencil, Play, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import type { Operation } from "@repo/schemas";
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

export const OperationDetailPageContent = () => {
  const { operationId } = Route.useParams();
  const { result: operationResult, query: operationQuery } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const operation = operationResult ?? null;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const store = useOperationDetailPageStore();
  const { handleBackLinkClick, handleEditButtonClick, handleOpenRunPanelButtonClick } = useStore(
    store,
    useShallow((s) => ({
      handleBackLinkClick: s.handleBackLinkClick,
      handleEditButtonClick: s.handleEditButtonClick,
      handleOpenRunPanelButtonClick: s.handleOpenRunPanelButtonClick,
    })),
  );
  const handleBackToOperationsClick = () => {
    handleBackLinkClick({
      navigateBack: () => {
        void navigate({ to: "/pipelines/operations" });
      },
    });
  };
  const handleEditOperationClick = (id: string) => {
    handleEditButtonClick(id, {
      navigateToEdit: (operationIdToEdit) => {
        void navigate({
          to: "/pipelines/operations/$operationId/edit",
          params: { operationId: operationIdToEdit },
        });
      },
    });
  };

  if (operationQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("operations.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("operations.operationNotFound")}
        </p>
        <Button className="h-auto p-0 text-xs" variant="link" onClick={handleBackToOperationsClick}>
          {t("common.backToList")}
        </Button>
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
              onClick={handleOpenRunPanelButtonClick}
            >
              <Play className="h-4 w-4" />
              {t("operations.run.run", "Run")}
            </Button>
            <Button
              aria-label={t("common.edit")}
              size="sm"
              variant="outline"
              onClick={() => handleEditOperationClick(operation.id)}
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
        <OutputItemsPanel />

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <ItemDetailPanel />
        </div>

        <OperationMetaPanel />
      </div>

      {/* Run panel */}
      <OperationRunPanel operationId={operation.id} />
    </div>
  );
};
