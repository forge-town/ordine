import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { ToastStoreProvider } from "@/store/toastStore";
import { SidebarStoreProvider } from "@/store/sidebarStore";
import { SearchPipelineDialog } from "./SearchPipelineDialog";
import { NewPipelineDialog } from "./NewPipelineDialog";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ToastStoreProvider>
      <SidebarStoreProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
          <ToastContainer />
          <SearchPipelineDialog />
          <NewPipelineDialog />
        </SidebarProvider>
      </SidebarStoreProvider>
    </ToastStoreProvider>
  );
};
