import { useOne } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { Distillation } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { DistillationResultPanel } from "@/components/DistillationResultPanel";
import { JobSourceAnalysisPanel } from "@/components/JobSourceAnalysisPanel";
import { PageLoadingState } from "@/components/PageLoadingState";
import { RefinementPanel } from "@/components/RefinementPanel";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/distillation-studio";
import { useDistillationStudioPageStore } from "./_store";
import { DistillationActionBar } from "./DistillationActionBar";
import { DistillationForm } from "./DistillationForm";

export const DistillationStudioPageContent = () => {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const existingDistillationId = search.distillationId ?? "";

  const store = useDistillationStudioPageStore();
  const latestDistillation = useStore(store, (s) => s.latestDistillation);
  const refinementId = useStore(store, (s) => s.refinementId);
  const currentSourceType = useStore(store, (s) => s.currentSourceType);
  const currentSourceId = useStore(store, (s) => s.currentSourceId);

  const { query: existingDistillationQuery } = useOne<Distillation>({
    resource: ResourceName.distillations,
    id: existingDistillationId,
    queryOptions: { enabled: !!existingDistillationId },
  });

  if (existingDistillationId && existingDistillationQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("distillations.studioTitle")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        backTo="/distillations"
        badge={
          latestDistillation ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{latestDistillation.status}</Badge>
              <Badge variant="outline">{latestDistillation.mode}</Badge>
            </div>
          ) : null
        }
        title={t("distillations.studioTitle")}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DistillationForm />

          <div className="space-y-4">
            <DistillationActionBar />
            {refinementId && <RefinementPanel refinementId={refinementId} />}
            <DistillationResultPanel distillation={latestDistillation} />
            {currentSourceType === "job" && currentSourceId ? (
              <JobSourceAnalysisPanel jobId={currentSourceId} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
