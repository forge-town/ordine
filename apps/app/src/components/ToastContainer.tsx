import { type FC } from "react";
import { Toast } from "@repo/ui/toast";
import { useToastStore } from "@/store/toastStore";

export const ToastContainer: FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast, index) => {
        const handleClose = () => removeToast(toast.id);
        return (
          <Toast
            key={toast.id}
            description={toast.description}
            duration={toast.duration}
            style={{
              position: "relative",
              right: 0,
              top: 0,
              marginTop: index > 0 ? "0.5rem" : 0,
            }}
            title={toast.title}
            type={toast.type}
            onClose={handleClose}
          />
        );
      })}
    </div>
  );
};
