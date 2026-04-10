import { type ReactNode, useRef } from "react";
import {
  HarnessCanvasStoreContext,
  createHarnessCanvasStore,
  type HarnessCanvasStore,
} from "./harnessCanvasStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { RecipeEntity } from "@/models/daos/recipesDao";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

interface LoadedPipeline {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
}

interface Props {
  children: ReactNode;
  pipeline?: LoadedPipeline | null;
  operations?: OperationEntity[];
  recipes?: RecipeEntity[];
  bestPractices?: BestPracticeEntity[];
}

export const HarnessCanvasStoreProvider = ({
  children,
  pipeline,
  operations = [],
  recipes = [],
  bestPractices = [],
}: Props) => {
  const storeRef = useRef<HarnessCanvasStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHarnessCanvasStore(
      pipeline?.nodes as PipelineNode[] | undefined,
      pipeline?.edges as PipelineEdge[] | undefined,
      pipeline?.id ?? null,
      pipeline?.name ?? "",
      operations,
      recipes,
      bestPractices,
    );
  }

  return (
    <HarnessCanvasStoreContext.Provider value={storeRef.current}>
      {children}
    </HarnessCanvasStoreContext.Provider>
  );
};
