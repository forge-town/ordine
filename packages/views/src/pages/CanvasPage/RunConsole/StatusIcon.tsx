import { Ban, CheckCircle2, CirclePause, Clock, Loader2, Terminal, XCircle } from "lucide-react";
import type { JobStatus } from "@repo/schemas";

interface StatusIconProps {
  status: JobStatus;
}

export const StatusIcon = ({ status }: StatusIconProps) => {
  switch (status) {
    case "running": {
      return (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 motion-reduce:animate-none" />
      );
    }
    case "done": {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    }
    case "failed": {
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    }
    case "queued": {
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    }
    case "paused": {
      return <CirclePause className="h-3.5 w-3.5 text-amber-500" />;
    }
    case "cancelled": {
      return <Ban className="h-3.5 w-3.5 text-muted-foreground" />;
    }
    case "expired": {
      return <Clock className="h-3.5 w-3.5 text-slate-500" />;
    }
    default: {
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  }
};
