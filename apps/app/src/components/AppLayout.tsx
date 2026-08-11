import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { toastStore, ToastStoreProvider } from "@/store/toastStore";
import { SidebarStoreProvider } from "@/store/sidebarStore";
import { SidebarStoreProvider as SharedSidebarStoreProvider } from "@repo/views/store/sidebarStore";
import { NotificationCenter } from "@repo/views/NotificationCenter";
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
              <SharedSidebarStoreProvider>
                <ThemeApplier />
                <ToastNotificationBridge toastStore={toastStore} />
                <SidebarProvider
                  className={cn(
                    canvasMode &&
                      "max-[1360px]:[&_[data-slot=sidebar-container]]:hidden max-[1360px]:[&_[data-slot=sidebar-gap]]:w-0",
                  )}
                  defaultWidth={236}
                  maxWidth={320}
                  minWidth={216}
                  widthStorageKey="ordine.sidebar.width"
                >
                  <AppSidebar />
                  <SidebarInset className={cn(canvasMode && "h-svh min-h-0 overflow-hidden")}>
                    {children}
                  </SidebarInset>
                  <ToastContainer />
                  <SearchPipelineDialog />
                  <NewPipelineDialog />
                  <NotificationCenter />
                </SidebarProvider>
              </SharedSidebarStoreProvider>
            </SidebarStoreProvider>
          </ToastStoreProvider>
        </AutonomyStoreProvider>
      </NotificationStoreProvider>
    </ThemeStoreProvider>
  );
};
