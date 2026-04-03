import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";

export const CanvasPage = () => {
  const { pipeline, operations } = Route.useLoaderData();

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline} operations={operations}>
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
