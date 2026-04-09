import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";

export const CanvasPage = () => {
  const { pipeline, operations, recipes } = Route.useLoaderData();

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider
        operations={operations}
        pipeline={pipeline}
        recipes={recipes}
      >
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
