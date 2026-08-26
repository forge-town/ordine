import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  GlobalAgentPanel,
  useOptionalAgentControlStore,
} from "../../../components/GlobalAgentControl";
import { setAgentHistoryGateway, useCanvasPageStore } from "../_store";

export const CanvasAgentControlBridge = () => {
  const agentStore = useOptionalAgentControlStore();
  const canvasStore = useCanvasPageStore();
  const pipelineId = useStore(canvasStore, (state) => state.pipelineId);
  const pipelineName = useStore(canvasStore, (state) => state.pipelineName);
  const selectedNodeId = useStore(canvasStore, (state) => state.selectedNodeId);
  const agentPanelIsOpen = useStore(canvasStore, (state) => state.agentPanel.isOpen);

  useEffect(() => {
    if (!agentStore) return;
    agentStore.getState().updateContext({
      pipelineId,
      selectedNodeIds: selectedNodeId ? [selectedNodeId] : [],
      selectedResources: pipelineId
        ? [{ type: "pipeline", id: pipelineId, ...(pipelineName ? { label: pipelineName } : {}) }]
        : [],
    });
  }, [agentStore, pipelineId, pipelineName, selectedNodeId]);

  useEffect(() => {
    if (!agentStore) return;
    agentStore.getState().setCanvasSurfaceOpen(agentPanelIsOpen);

    return () => agentStore.getState().setCanvasSurfaceOpen(false);
  }, [agentPanelIsOpen, agentStore]);

  useEffect(() => {
    if (!agentStore || !pipelineId) return;
    agentStore.getState().registerCanvasSurface({
      pipelineId,
      get isOpen() {
        return canvasStore.getState().agentPanel.isOpen;
      },
      openPanel: () => {
        const state = canvasStore.getState();
        if (!state.agentPanel.isOpen) state.toggleAgentPanel();
      },
      hydrateChangeSet: (changeSet, appliedActionIds) =>
        canvasStore.getState().hydrateAgentChangeSet(changeSet, appliedActionIds),
      applyDraftAction: (input) => canvasStore.getState().applyAgentDraftAction(input),
      rollbackChangeSet: (changeSetId) =>
        canvasStore.getState().rollbackAgentChangeSet(changeSetId),
      commitChangeSet: (input) => canvasStore.getState().commitAgentChangeSet(input),
    });
    setAgentHistoryGateway({
      revert: (changeSetId, expectedVersion) =>
        agentStore.getState().revertChangeSet(changeSetId, expectedVersion),
      redo: (changeSetId, expectedVersion) =>
        agentStore.getState().redoChangeSet(changeSetId, expectedVersion),
      reportError: (message) => agentStore.setState({ error: message }),
    });

    return () => {
      agentStore.getState().registerCanvasSurface(null);
      setAgentHistoryGateway(null);
      agentStore.getState().updateContext({
        pipelineId: null,
        selectedNodeIds: [],
        selectedResources: [],
      });
    };
  }, [agentStore, canvasStore, pipelineId]);

  return null;
};

export const CanvasAgentControlPanel = () => {
  const { t } = useTranslation();
  const agentStore = useOptionalAgentControlStore();

  return agentStore ? (
    <GlobalAgentPanel />
  ) : (
    <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
      {t("agentControl.previewUnavailable")}
    </div>
  );
};
