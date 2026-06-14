import { useStore } from "zustand";
import { SkillsPageStoreProvider, useSkillsPageStore } from "./_store";
import { SkillsPageContent } from "./SkillsPageContent";
import { SkillToOperationDialog } from "@/components/SkillToOperationDialog";

const SkillsPageInner = () => {
  const store = useSkillsPageStore();
  const createOperationDialogOpen = useStore(store, (s) => s.createOperationDialogOpen);
  const selectedSkillId = useStore(store, (s) => s.selectedSkillId);
  const handleCreateOperationDialogClose = useStore(
    store,
    (s) => s.handleCreateOperationDialogClose,
  );

  return (
    <>
      <SkillsPageContent />
      <SkillToOperationDialog
        key={selectedSkillId ?? "closed"}
        open={createOperationDialogOpen}
        skillId={selectedSkillId}
        onClose={handleCreateOperationDialogClose}
      />
    </>
  );
};

export const SkillsPage = () => {
  return (
    <SkillsPageStoreProvider>
      <SkillsPageInner />
    </SkillsPageStoreProvider>
  );
};
