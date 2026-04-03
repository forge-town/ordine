import { CheckCircle, XCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./lib/utils";
import { Button } from "./button";

export interface ToastProps {
  type: "success" | "error";
  title: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
  style?: React.CSSProperties;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const Toast = ({
  type,
  title,
  description,
  duration = 4000,
  onClose,
  style,
  action,
}: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 200);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 200);
  };

  return (
    <div
      style={style}
      className={cn(
        "fixed right-4 z-50 flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 max-w-md",
        type === "success" && "bg-green-50 border-green-200 text-green-800",
        type === "error" && "bg-red-50 border-red-200 text-red-800",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      )}
    >
      <div className="shrink-0">
        {type === "success" ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        {description && (
          <div className="text-sm opacity-90 mt-1">{description}</div>
        )}
        {action && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-transparent"
        onClick={handleClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
