import { ToastContainer } from "./ToastContainer";
import { ToastStoreProvider } from "@/store/toastProvider";

interface CanvasLayoutProps {
  children: React.ReactNode;
}

export const CanvasLayout = ({ children }: CanvasLayoutProps) => {
  return (
    <ToastStoreProvider>
      <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-slate-50">
        {children}
        <ToastContainer />
      </div>
    </ToastStoreProvider>
  );
};
