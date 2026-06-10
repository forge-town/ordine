import { useStore } from "zustand";
import { useTranslation } from "react-i18next";
import { Bot, Maximize2, PanelLeftClose, PanelLeftOpen, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useCanvasPageStore } from "../_store";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const handleFitView = useStore(store, (state) => state.handleFitView);
  const handleZoomIn = useStore(store, (state) => state.handleZoomIn);
  const handleZoomOut = useStore(store, (state) => state.handleZoomOut);
  const handleToggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const handleToggleSidebar = useStore(store, (state) => state.handleToggleSidebar);
  const SidebarIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const sidebarLabel = isSidebarOpen
    ? t("canvas.componentPanel.collapse")
    : t("canvas.componentPanel.expand");

  return (
    <div className="pointer-events-auto w-max" data-testid="canvas-toolbar">
      <div className="flex h-10 items-center gap-0.5 rounded-full border border-border bg-background/95 px-1.5 shadow-float backdrop-blur">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.zoomOut")}
                className="h-7 w-7 rounded-full"
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
              />
            }
          >
            <ZoomOut className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomOut")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.zoomIn")}
                className="h-7 w-7 rounded-full"
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
              />
            }
          >
            <ZoomIn className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomIn")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.fitView")}
                className="h-7 w-7 rounded-full"
                size="icon"
                variant="ghost"
                onClick={handleFitView}
              />
            }
          >
            <Maximize2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.fitView")}</TooltipContent>
        </Tooltip>

        <Separator className="mx-1 h-6" orientation="vertical" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.agentPanel.toggle")}
                aria-pressed={agentPanelIsOpen}
                className="h-7 w-7 rounded-full"
                size="icon"
                variant="ghost"
                onClick={handleToggleAgentPanel}
              />
            }
          >
            <Bot className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.agentPanel.toggle")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={sidebarLabel}
                aria-pressed={isSidebarOpen}
                className="h-7 w-7 rounded-full"
                size="icon"
                variant="ghost"
                onClick={handleToggleSidebar}
              />
            }
          >
            <SidebarIcon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{sidebarLabel}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
