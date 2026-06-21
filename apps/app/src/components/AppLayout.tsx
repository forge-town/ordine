import { useRef, useState, type CSSProperties } from "react";
import { PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationCenter } from "./NotificationCenter";
import { ResizeHandle } from "./ResizeHandle";
import { ToastContainer } from "./ToastContainer";
import { ToastStoreProvider } from "@/store/toastStore";
import { SidebarStoreProvider } from "@/store/sidebarStore";
import { SearchPipelineDialog } from "./SearchPipelineDialog";
import { NewPipelineDialog } from "./NewPipelineDialog";

const SIDEBAR_WIDTH_KEY = "ordine.sidebarWidth";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 360;
const SIDEBAR_COLLAPSE_AT = 168;
const SIDEBAR_DEFAULT = 236;

const loadSidebarWidth = (): number => {
  const raw = globalThis.localStorage?.getItem(SIDEBAR_WIDTH_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;

  return Number.isFinite(parsed)
    ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, parsed))
    : SIDEBAR_DEFAULT;
};

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const dragStartWidth = useRef(sidebarWidth);

  const handleDelta = (delta: number) => {
    const next = dragStartWidth.current + delta;
    if (next < SIDEBAR_COLLAPSE_AT) {
      setSidebarOpen(false);

      return;
    }
    const clamped = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, next));
    setSidebarWidth(clamped);
    globalThis.localStorage?.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  };

  return (
    <ToastStoreProvider>
      <SidebarStoreProvider>
        <SidebarProvider
          open={sidebarOpen}
          style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
          onOpenChange={setSidebarOpen}
        >
          <AppSidebar />
          {sidebarOpen ? (
            <ResizeHandle
              side="left"
              onCollapse={() => setSidebarOpen(false)}
              onDelta={handleDelta}
              onDragStart={() => {
                dragStartWidth.current = sidebarWidth;
              }}
            />
          ) : null}
          <SidebarInset>{children}</SidebarInset>
          {!sidebarOpen ? (
            <button
              aria-label={t("sidebar.reopen")}
              className="group fixed left-0 top-1/2 z-40 flex h-14 w-[22px] -translate-y-1/2 items-center justify-center rounded-r-xl bg-surface shadow-float ring-1 ring-border-strong transition-all hover:w-7"
              data-testid="sidebar-reopen"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          ) : null}
          <NotificationCenter />
          <ToastContainer />
          <SearchPipelineDialog />
          <NewPipelineDialog />
        </SidebarProvider>
      </SidebarStoreProvider>
    </ToastStoreProvider>
  );
};
