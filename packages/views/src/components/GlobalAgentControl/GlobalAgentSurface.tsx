import { FormEvent } from "react";
import { useInvalidate } from "@refinedev/core";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Bot, LoaderCircle, Send, Square } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { GlobalAgentPanel } from "./GlobalAgentPanel";
import { ResourceName } from "../../constants";
import { useSidebarStore } from "../../store/sidebarStore";
import { useAgentControl, useOptionalAgentControlStore } from "./GlobalAgentControlProvider";

const GlobalAgentSurfaceContent = () => {
  const { t } = useTranslation();
  const { location } = useRouterState();
  const router = useRouter();
  const invalidate = useInvalidate();
  const sidebarStore = useSidebarStore();
  const projectId = useStore(sidebarStore, (state) => state.currentProjectId);
  const isCanvas = location.pathname === "/canvas";
  const capabilities = useAgentControl((state) => state.capabilities);
  const draft = useAgentControl((state) => state.draft);
  const isRunning = useAgentControl((state) => state.isRunning);
  const drawerOpen = useAgentControl((state) => state.isDrawerOpen);
  const isCanvasSurfaceOpen = useAgentControl((state) => state.isCanvasSurfaceOpen);
  const setDraft = useAgentControl((state) => state.setDraft);
  const setDrawerOpen = useAgentControl((state) => state.setDrawerOpen);
  const openPreferredSurface = useAgentControl((state) => state.openPreferredSurface);
  const submit = useAgentControl((state) => state.submit);
  const stop = useAgentControl((state) => state.stop);
  const updateContext = useAgentControl((state) => state.updateContext);
  const registerInvalidator = useAgentControl((state) => state.registerInvalidator);
  const registerNavigator = useAgentControl((state) => state.registerNavigator);
  const supported =
    capabilities?.enabled && capabilities.runtimes.some((runtime) => runtime.supported);
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setDrawerOpen(true);
    void submit();
  };

  useEffect(() => {
    updateContext({
      route: { pathname: location.pathname },
      projectId,
    });
  }, [location.pathname, projectId, updateContext]);

  useEffect(() => {
    const resourceNames: Partial<Record<string, string>> = {
      agent: ResourceName.agents,
      connector: ResourceName.connectors,
      distillation: ResourceName.distillations,
      job: ResourceName.jobs,
      operation: ResourceName.operations,
      pipeline: ResourceName.pipelines,
      "pipeline-asset": ResourceName.pipelineAssets,
      project: ResourceName.projects,
      routine: ResourceName.routines,
      skill: ResourceName.skills,
    };
    registerInvalidator(async (resources) => {
      await Promise.all(
        resources.map((resource) => {
          const resourceName = resourceNames[resource.type];
          if (!resourceName) return Promise.resolve();

          return invalidate({
            resource: resourceName,
            id: resource.id,
            invalidates: ["list", "many", "detail"],
          });
        }),
      );
    });
    registerNavigator((pathname) => router.history.push(pathname));

    return () => {
      registerInvalidator(null);
      registerNavigator(null);
    };
  }, [invalidate, registerInvalidator, registerNavigator, router]);

  if (!capabilities?.enabled) return null;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 transition-transform duration-200 motion-reduce:transition-none",
          isCanvas && "justify-end pr-4",
          isCanvas && isCanvasSurfaceOpen && "hidden",
        )}
        data-testid="global-agent-bar"
      >
        {isCanvas ? (
          <Button
            className="pointer-events-auto h-10 rounded-full px-4 shadow-float"
            variant={isRunning ? "secondary" : "default"}
            onClick={openPreferredSurface}
          >
            {isRunning ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Bot />
            )}
            {isRunning ? t("agentControl.surface.working") : t("agentControl.surface.launcher")}
          </Button>
        ) : (
          <form
            className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-border-strong bg-surface/95 p-2 shadow-float supports-backdrop-filter:backdrop-blur-xl"
            onSubmit={handleSubmit}
          >
            <Button
              aria-label={t("agentControl.surface.openActivity")}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setDrawerOpen(true)}
            >
              {isRunning ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Bot />
              )}
            </Button>
            <Input
              aria-label={t("agentControl.composer.label")}
              className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              disabled={!supported}
              placeholder={
                supported
                  ? t("agentControl.composer.placeholder")
                  : t("agentControl.surface.noRuntime")
              }
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {isRunning ? (
              <Button
                aria-label={t("agentControl.composer.stop")}
                size="icon"
                type="button"
                variant="outline"
                onClick={() => void stop()}
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                aria-label={t("agentControl.composer.send")}
                disabled={!supported || !draft.trim()}
                size="icon"
                type="submit"
              >
                <Send />
              </Button>
            )}
          </form>
        )}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          className="max-w-none gap-0 p-0"
          side="right"
          style={{ width: "min(100vw, 30rem)", maxWidth: "100vw" }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("agentControl.surface.title")}</SheetTitle>
          </SheetHeader>
          <GlobalAgentPanel />
        </SheetContent>
      </Sheet>
    </>
  );
};

export const GlobalAgentSurface = () => {
  const store = useOptionalAgentControlStore();

  return store ? <GlobalAgentSurfaceContent /> : null;
};
