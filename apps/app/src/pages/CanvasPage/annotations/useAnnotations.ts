import { createContext, useCallback, useContext, useMemo } from "react";
import { useCreate, useList, type HttpError } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import type { Annotation, AnnotationTargetType, CreateAnnotationInput } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface CreateNodeAnnotationInput {
  content: string;
  targetId: string;
  targetType: AnnotationTargetType;
}

export interface UseAnnotationsResult {
  annotations: Annotation[];
  annotationsByTargetId: Map<string, Annotation[]>;
  createAnnotation: (input: CreateNodeAnnotationInput) => Promise<Annotation | null>;
  isCreating: boolean;
  isLoading: boolean;
  pipelineId: string | null;
}

const emptyAnnotations: Annotation[] = [];
const emptyAnnotationsByTargetId = new Map<string, Annotation[]>();

export const CanvasAnnotationsContext = createContext<UseAnnotationsResult | null>(null);

export const useAnnotations = (pipelineId: string | null): UseAnnotationsResult => {
  const { result: annotationsResult, query: annotationsQuery } = useList<Annotation>({
    filters: pipelineId
      ? [
          {
            field: "pipelineId",
            operator: "eq",
            value: pipelineId,
          },
        ]
      : [],
    queryOptions: { enabled: !!pipelineId },
    resource: ResourceName.annotations,
  });
  const { mutateAsync: createAnnotationMutate, mutation: createMutation } = useCreate<
    Annotation,
    HttpError,
    CreateAnnotationInput
  >();
  const annotations = annotationsResult.data ?? emptyAnnotations;
  const annotationsByTargetId = useMemo(() => {
    const map = new Map<string, Annotation[]>();

    for (const annotation of annotations) {
      const targetAnnotations = map.get(annotation.targetId) ?? [];
      targetAnnotations.push(annotation);
      map.set(annotation.targetId, targetAnnotations);
    }

    return map;
  }, [annotations]);

  const createAnnotation = useCallback(
    async ({ content, targetId, targetType }: CreateNodeAnnotationInput) => {
      const trimmed = content.trim();
      if (!pipelineId || !trimmed) {
        return null;
      }

      const created = await ResultAsync.fromPromise(
        createAnnotationMutate({
          errorNotification: false,
          resource: ResourceName.annotations,
          successNotification: false,
          values: {
            author: "user",
            content: trimmed,
            pipelineId,
            resolved: false,
            targetId,
            targetType,
          },
        }),
        () => null,
      );
      if (created.isErr()) {
        return null;
      }

      await annotationsQuery?.refetch?.();

      return created.value.data;
    },
    [annotationsQuery, createAnnotationMutate, pipelineId],
  );

  return {
    annotations,
    annotationsByTargetId,
    createAnnotation,
    isCreating: createMutation.isPending,
    isLoading: annotationsQuery?.isLoading ?? false,
    pipelineId,
  };
};

export const useCanvasAnnotations = () => useContext(CanvasAnnotationsContext);

export const useNodeAnnotations = (targetId: string) => {
  const context = useCanvasAnnotations();

  return context?.annotationsByTargetId.get(targetId) ?? emptyAnnotations;
};

export const useTargetAnnotations = (targetId: string | null) => {
  const context = useCanvasAnnotations();

  if (!targetId) {
    return emptyAnnotations;
  }

  return context?.annotationsByTargetId.get(targetId) ?? emptyAnnotations;
};

export const emptyCanvasAnnotationsContext: UseAnnotationsResult = {
  annotations: emptyAnnotations,
  annotationsByTargetId: emptyAnnotationsByTargetId,
  createAnnotation: async () => null,
  isCreating: false,
  isLoading: false,
  pipelineId: null,
};
