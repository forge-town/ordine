import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { toastStore, ToastStoreProvider } from "../store/toastStore";
import { SidebarStoreProvider } from "../store/sidebarStore";
import { AutonomyStoreProvider } from "../store/autonomyStore";
import { NotificationStoreProvider, ToastNotificationBridge } from "../store/notificationStore";
import { ThemeApplier, ThemeStoreProvider } from "../store/themeStore";
import { SearchPipelineDialog } from "./SearchPipelineDialog";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeStoreProvider>
      <NotificationStoreProvider>
        <AutonomyStoreProvider>
          <ToastStoreProvider>
            <SidebarStoreProvider>
              <ThemeApplier />
              <ToastNotificationBridge toastStore={toastStore} />
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>{children}</SidebarInset>
                <ToastContainer />
                <SearchPipelineDialog />
              </SidebarProvider>
            </SidebarStoreProvider>
          </ToastStoreProvider>
        </AutonomyStoreProvider>
      </NotificationStoreProvider>
    </ThemeStoreProvider>
  );
};
