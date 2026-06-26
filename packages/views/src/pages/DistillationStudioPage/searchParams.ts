import type { DistillationMode, DistillationSourceType } from "@repo/schemas";

// Shape of the distillation studio URL search params. The route owning this page
// (web: /distillation-studio, desktop: /distillations/new) validates these; the
// shared page reads them via useSearch({ strict: false }) cast to this type.
export type DistillationStudioSearch = {
  distillationId?: string;
  sourceType?: DistillationSourceType;
  sourceId?: string;
  sourceLabel?: string;
  mode?: DistillationMode;
};
