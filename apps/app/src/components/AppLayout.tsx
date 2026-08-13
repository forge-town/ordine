import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { toastStore, ToastStoreProvider } from "@/store/toastStore";
import { SidebarStoreProvider } from "@/store/sidebarStore";
import { SidebarStoreProvider as SharedSidebarStoreProvider } from "@repo/views/store/sidebarStore";
import { ToastStoreProvider as SharedToastStoreProvider } from "@repo/views/store/toastStore";
import { ToastContainer as SharedToastContainer } from "@repo/views/ToastContainer";
import { SearchPipelineDialog } from "@repo/views/SearchPipelineDialog";
import { NewPipelineDialog } from "./NewPipelineDialog";
import { AutonomyStoreProvider } from "@repo/views/store/autonomyStore";
import {
  NotificationStoreProvider,
  ToastNotificationBridge,
} from "@repo/views/store/notificationStore";
import { ThemeApplier, ThemeStoreProvider } from "@repo/views/store/themeStore";
import { cn } from "@repo/ui/lib/utils";

export const AppLayout = ({
  canvasMode = false,
  children,
}: {
  canvasMode?: boolean;
  children: React.ReactNode;
}) => {
  return (
    <ThemeStoreProvider>
      <NotificationStoreProvider>
        <AutonomyStoreProvider>
          <ToastStoreProvider>
            <SidebarStoreProvider>
              <SharedToastStoreProvider>
                <SharedSidebarStoreProvider>
                  <ThemeApplier />
                  <ToastNotificationBridge toastStore={toastStore} />
                  <SidebarProvider
                    className={cn(
                      canvasMode &&
                        "[&_[data-slot=sidebar-container]]:hidden [&_[data-slot=sidebar-gap]]:w-0",
                    )}
                    defaultWidth={236}
                    maxWidth={320}
                    minWidth={216}
                    widthStorageKey="ordine.sidebar.width"
                  >
                    <AppSidebar />
                    <SidebarInset className={cn(canvasMode && "h-svh min-h-0 overflow-hidden")}>
                      {!canvasMode && (
                        <div className="hidden h-12 shrink-0 items-center border-b border-border px-3 min-[701px]:flex md:hidden">
                          <SidebarTrigger />
                        </div>
                      )}
                      {children}
                    </SidebarInset>
                    <ToastContainer />
                    <SharedToastContainer />
                    <SearchPipelineDialog />
                    <NewPipelineDialog />
                  </SidebarProvider>
                </SharedSidebarStoreProvider>
              </SharedToastStoreProvider>
            </SidebarStoreProvider>
          </ToastStoreProvider>
        </AutonomyStoreProvider>
      </NotificationStoreProvider>
    </ThemeStoreProvider>
  );
};
