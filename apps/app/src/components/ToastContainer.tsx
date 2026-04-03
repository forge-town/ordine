import { type FC } from "react";
import { Toast } from "@repo/ui/toast";
import { useToastStore } from "@/hooks/useToastStore";

export const ToastContainer: FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          type={toast.type}
          title={toast.title}
          description={toast.description}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
          style={{
            position: "relative",
            right: 0,
            top: 0,
            marginTop: index > 0 ? "0.5rem" : 0,
          }}
        />
      ))}
    </div>
  );
};
