import type { MouseEvent as ReactMouseEvent } from "react";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";

export const useNodeCardActions = (nodeId: string) => {
  const store = useCanvasPageStore();
  const focusNode = useStore(store, (state) => state.focusNode);
  const duplicateNode = useStore(store, (state) => state.duplicateNode);
  const removeNode = useStore(store, (state) => state.removeNode);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const toggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);

  const handleConfigure = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    focusNode(nodeId);
  };
  const handleAsk = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    focusNode(nodeId);
    if (!agentPanelIsOpen) {
      toggleAgentPanel();
    }
  };
  const handleDuplicate = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    duplicateNode(nodeId);
  };
  const handleDelete = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    removeNode(nodeId);
  };

  return {
    onAsk: handleAsk,
    onConfigure: handleConfigure,
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
  };
};
