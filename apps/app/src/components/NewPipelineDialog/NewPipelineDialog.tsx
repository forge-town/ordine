import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useSidebarStore } from "@/store/sidebarStore";
import {
  PipelineCreationWorkspace,
  type PipelineCreationWorkspaceProps,
} from "../PipelineCreationWorkspace";

export interface NewPipelineDialogProps {
  client?: PipelineCreationWorkspaceProps["client"];
  materializePipeline?: PipelineCreationWorkspaceProps["materializePipeline"];
}

export const NewPipelineDialog = ({ client, materializePipeline }: NewPipelineDialogProps = {}) => {
  const { t } = useTranslation();
  const store = useSidebarStore();
  const open = useStore(store, (state) => state.newPipelineOpen);
  const handleNewPipelineDialogOpenChange = useStore(
    store,
    (state) => state.handleNewPipelineDialogOpenChange,
  );
  const handleClose = () => handleNewPipelineDialogOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleNewPipelineDialogOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("nav.newPipeline")}</DialogTitle>
          <DialogDescription>{t("pipelines.newPipelineDescription")}</DialogDescription>
        </DialogHeader>
        <PipelineCreationWorkspace
          active={open}
          client={client}
          materializePipeline={materializePipeline}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
};
