import { CanvasLayout } from "@/components/CanvasLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import { Route } from "@/routes/canvas";

export const CanvasPage = () => {
  const { pipeline } = Route.useLoaderData();

  return (
    <CanvasLayout>
      <HarnessCanvasStoreProvider pipeline={pipeline}>
        <CanvasPageContent />
      </HarnessCanvasStoreProvider>
    </CanvasLayout>
  );
};
