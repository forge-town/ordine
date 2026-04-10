import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";

export const CanvasPage = () => {
  const { pipeline, operations, recipes, bestPractices } =
    Route.useLoaderData();

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider
        bestPractices={bestPractices}
        operations={operations}
        pipeline={pipeline}
        recipes={recipes}
      >
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
