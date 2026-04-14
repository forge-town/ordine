import { SidebarInset, SidebarProvider } from "@repo/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ToastContainer } from "./ToastContainer";
import { ToastStoreProvider } from "@/store/toastProvider";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ToastStoreProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
        <ToastContainer />
      </SidebarProvider>
    </ToastStoreProvider>
  );
};
