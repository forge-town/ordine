import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { HarnessCanvasPageContent } from "./HarnessCanvasPageContent";
import { Route } from "@/routes/canvas";

export const HarnessCanvasPage = () => {
  const pipeline = Route.useLoaderData();

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline ?? null}>
        <HarnessCanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
