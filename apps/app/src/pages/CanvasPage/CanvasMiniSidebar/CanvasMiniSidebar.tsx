import {
  Menu,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Settings2,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useCanvasPageStore } from "../_store";

export const CANVAS_WORKSPACE_SIDEBAR_ID = "canvas-workspace-sidebar-overlay";

export const CanvasMiniSidebar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const isWorkspaceSidebarOpen = useStore(store, (state) => state.isWorkspaceSidebarOpen);
  const nodeCardMode = useStore(store, (state) => state.nodeCardMode);
  const handleOpenWorkspaceSidebar = useStore(store, (state) => state.openWorkspaceSidebar);
  const handleOpenCanvasSettings = useStore(store, (state) => state.openCanvasSettings);
  const handleToggleNodeCardMode = useStore(store, (state) => state.toggleNodeCardMode);
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const handleToggleSidebar = useStore(
    store,
    (state) => state.handleToggleSidebar,
  );

  const workspaceLabel = t("canvas.workspaceSidebar.title", {
    defaultValue: "Workspace",
  });
  const settingsLabel = t("canvas.settingsDrawer.menuLabel");
  const compactCardsLabel = t("canvas.nodeCardMode.compact", {
    defaultValue: "Compact cards",
  });
  const nodeCardModeLabel =
    nodeCardMode === "compact"
      ? compactCardsLabel
      : t("canvas.nodeCardMode.expanded", { defaultValue: "Expanded cards" });
  const operationsPanelLabel = isSidebarOpen
    ? t("canvas.operationsPanel.collapse", { defaultValue: "Collapse operations panel" })
    : t("canvas.operationsPanel.expand", { defaultValue: "Expand operations panel" });

  return (
    <aside
      className="flex w-14 shrink-0 flex-col items-center gap-2 border-r bg-background/95 px-2 py-3 backdrop-blur"
      data-testid="canvas-mini-sidebar"
    >
      <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40 text-primary">
        <Workflow className="size-4" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-controls={CANVAS_WORKSPACE_SIDEBAR_ID}
                aria-expanded={isWorkspaceSidebarOpen}
                aria-label={workspaceLabel}
                className="size-9 rounded-md"
                size="icon"
                variant={isWorkspaceSidebarOpen ? "secondary" : "ghost"}
                onClick={handleOpenWorkspaceSidebar}
              />
            }
          >
            <Menu className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{workspaceLabel}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={operationsPanelLabel}
                aria-pressed={isSidebarOpen}
                className="size-9 rounded-md"
                size="icon"
                variant={isSidebarOpen ? "secondary" : "ghost"}
                onClick={handleToggleSidebar}
              />
            }
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent>{operationsPanelLabel}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={compactCardsLabel}
                aria-pressed={nodeCardMode === "compact"}
                className="size-9 rounded-md"
                size="icon"
                variant={nodeCardMode === "compact" ? "secondary" : "ghost"}
                onClick={handleToggleNodeCardMode}
              />
            }
          >
            {nodeCardMode === "compact" ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelRight className="size-4" />
            )}
          </TooltipTrigger>
          <TooltipContent>{nodeCardModeLabel}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={settingsLabel}
                className="size-9 rounded-md"
                size="icon"
                variant="ghost"
                onClick={handleOpenCanvasSettings}
              />
            }
          >
            <Settings2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>{settingsLabel}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};
