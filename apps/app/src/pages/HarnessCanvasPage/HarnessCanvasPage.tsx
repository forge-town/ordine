import { AppLayout } from "@/components/AppLayout";
import { HarnessCanvasStoreProvider } from "./_store";
import { HarnessCanvasPageContent } from "./HarnessCanvasPageContent";

export const HarnessCanvasPage = () => {
  return (
    <AppLayout>
      <HarnessCanvasStoreProvider>
        <HarnessCanvasPageContent />
      </HarnessCanvasStoreProvider>
    </AppLayout>
  );
};
