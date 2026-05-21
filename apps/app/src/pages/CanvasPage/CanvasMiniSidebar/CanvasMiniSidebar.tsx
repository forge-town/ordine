import { Menu, PanelLeft, PanelRight, Settings2, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useCanvasPageStore } from "../_store";

export const CanvasMiniSidebar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const isWorkspaceSidebarOpen = useStore(store, (state) => state.isWorkspaceSidebarOpen);
  const nodeCardMode = useStore(store, (state) => state.nodeCardMode);
  const openWorkspaceSidebar = useStore(store, (state) => state.openWorkspaceSidebar);
  const openCanvasSettings = useStore(store, (state) => state.openCanvasSettings);
  const toggleNodeCardMode = useStore(store, (state) => state.toggleNodeCardMode);

  const workspaceLabel = t("canvas.workspaceSidebar.title", { defaultValue: "Workspace" });
  const settingsLabel = t("canvas.settingsDrawer.menuLabel");
  const nodeCardLabel =
    nodeCardMode === "compact"
      ? t("canvas.nodeCardMode.compact", { defaultValue: "Compact cards" })
      : t("canvas.nodeCardMode.expanded", { defaultValue: "Expanded cards" });
  const handleOpenWorkspaceSidebar = () => {
    openWorkspaceSidebar();
  };
  const handleToggleNodeCardMode = () => {
    toggleNodeCardMode();
  };
  const handleOpenCanvasSettings = () => {
    openCanvasSettings();
  };

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
                aria-label={workspaceLabel}
                aria-pressed={isWorkspaceSidebarOpen}
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
                aria-label={nodeCardLabel}
                aria-pressed={nodeCardMode === "expanded"}
                className="size-9 rounded-md"
                size="icon"
                variant={nodeCardMode === "expanded" ? "secondary" : "ghost"}
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
          <TooltipContent>{nodeCardLabel}</TooltipContent>
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
