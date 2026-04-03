import { ToastContainer } from "./ToastContainer";

interface CanvasLayoutProps {
  children: React.ReactNode;
}

export const CanvasLayout = ({ children }: CanvasLayoutProps) => {
  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-slate-50">
      {children}
      <ToastContainer />
    </div>
  );
};
