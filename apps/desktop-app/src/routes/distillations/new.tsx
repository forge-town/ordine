import { createFileRoute } from "@tanstack/react-router";

type StudioSearch = {
  distillationId?: string;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
  mode?: string;
};

// Placeholder route so shared views (e.g. PipelineDetailPage) can navigate to
// the distillation studio on desktop. The full DistillationStudioPage migration
// is a separate follow-up.
export const Route = createFileRoute("/distillations/new")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    distillationId: search.distillationId as string | undefined,
    sourceType: search.sourceType as string | undefined,
    sourceId: search.sourceId as string | undefined,
    sourceLabel: search.sourceLabel as string | undefined,
    mode: search.mode as string | undefined,
  }),
  component: () => <div>Distillation Studio</div>,
});
