import { useEffect, useState, type ReactNode } from "react";
import { startServer, stopServer } from "../integrations/sidecar/server";

type ServerState = "starting" | "ready" | "error";

export function ServerGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState>("starting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    startServer()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setState("error");
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
      stopServer();
    };
  }, []);

  if (state === "starting") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Starting server...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to start server</p>
          <p className="text-muted-foreground text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
