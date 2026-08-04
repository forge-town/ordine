import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { toastStore, ToastStoreProvider } from "@/store/toastStore";
import { SidebarStoreProvider } from "@/store/sidebarStore";
import { SearchPipelineDialog } from "./SearchPipelineDialog";
import { NewPipelineDialog } from "./NewPipelineDialog";
import { AutonomyStoreProvider } from "@repo/views/store/autonomyStore";
import {
  NotificationStoreProvider,
  ToastNotificationBridge,
} from "@repo/views/store/notificationStore";
import { ThemeApplier, ThemeStoreProvider } from "@repo/views/store/themeStore";

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
                <NewPipelineDialog />
              </SidebarProvider>
            </SidebarStoreProvider>
          </ToastStoreProvider>
        </AutonomyStoreProvider>
      </NotificationStoreProvider>
    </ThemeStoreProvider>
  );
};
