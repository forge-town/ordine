import { DistillationStudioPageStoreProvider } from "./_store";
import { DistillationStudioPageContent } from "./DistillationStudioPageContent";

export const DistillationStudioPage = () => {
  return (
    <DistillationStudioPageStoreProvider>
      <DistillationStudioPageContent />
    </DistillationStudioPageStoreProvider>
  );
};
