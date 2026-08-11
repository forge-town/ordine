import { ToastContainer } from "../../components/ToastContainer";
import { ToastStoreProvider } from "../../store/toastStore";
import { cn } from "@repo/ui/lib/utils";

interface CanvasLayoutProps {
  children: React.ReactNode;
  embedded?: boolean;
}

export const CanvasLayout = ({ children, embedded = false }: CanvasLayoutProps) => {
  const content = (
    <div
      className={cn(
        "inset-0 overflow-hidden bg-background",
        embedded ? "absolute h-full w-full" : "fixed h-screen w-screen",
      )}
    >
      {children}
      {!embedded && <ToastContainer />}
    </div>
  );

  return embedded ? content : <ToastStoreProvider>{content}</ToastStoreProvider>;
};
