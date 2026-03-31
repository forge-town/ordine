import { AppLayout } from "@/components/AppLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { HarnessCanvasPageContent } from "./HarnessCanvasPageContent";
import { Route } from "@/routes/canvas";

export const HarnessCanvasPage = () => {
  const pipeline = Route.useLoaderData();

  return (
    <AppLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline ?? null}>
        <HarnessCanvasPageContent />
      </HarnessCanvasStoreProvider>
    </AppLayout>
  );
};
