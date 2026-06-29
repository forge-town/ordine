import { createFileRoute } from "@tanstack/react-router";
import { DistillationStudioPage } from "@repo/views/DistillationStudioPage";

type StudioSearch = {
  distillationId?: string;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
  mode?: string;
};

export const Route = createFileRoute("/distillations/new")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    distillationId: search.distillationId as string | undefined,
    sourceType: search.sourceType as string | undefined,
    sourceId: search.sourceId as string | undefined,
    sourceLabel: search.sourceLabel as string | undefined,
    mode: search.mode as string | undefined,
  }),
  component: DistillationStudioPage,
});
