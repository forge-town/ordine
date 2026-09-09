import { useEffect, useState, type ReactNode } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ResultAsync } from "neverthrow";
import { DesktopSessionContext } from "../integrations/sidecar/DesktopSessionContext";
import {
  DesktopStatusSchema,
  readNativeCredentials,
  readNativeStatus,
  type DesktopStatus,
  type DesktopCredentials,
} from "../integrations/sidecar/server";

export const DesktopLifecycleProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<{
    status: DesktopStatus;
    credentials: DesktopCredentials | null;
  }>({
    status: {
      phase: "starting",
      instanceId: "",
      workspaceId: "local",
      port: null,
      error: null,
      databaseConfigured: false,
    },
    credentials: null,
  });
  // Native IPC observation only. React never creates, restarts, or terminates a process.
  useEffect(() => {
    const subscription: { closed: boolean; unlisten?: UnlistenFn } = { closed: false };
    const receive = (status: DesktopStatus) => {
      if (subscription.closed) return;
      setSession((current) => ({
        status,
        credentials:
          status.phase === "ready" && current.credentials?.instanceId === status.instanceId
            ? current.credentials
            : null,
      }));
      if (status.phase === "ready") {
        void readNativeCredentials().match(
          (credentials) => {
            if (subscription.closed) return;
            setSession((current) =>
              current.status.phase === "ready" &&
              current.status.instanceId === credentials.instanceId
                ? { ...current, credentials }
                : current,
            );
          },
          () => undefined,
        );
      }
    };
    const refresh = () =>
      void readNativeStatus().match(receive, (error) => {
        if (!subscription.closed)
          setSession((current) => ({
            ...current,
            credentials: null,
            status: { ...current.status, phase: "failed", error: error.message },
          }));
      });
    void ResultAsync.fromPromise(
      listen("execution-state", (event) => {
        const parsed = DesktopStatusSchema.safeParse(event.payload);
        if (parsed.success) receive(parsed.data);
      }),
      () => undefined,
    ).match((unlisten) => {
      if (subscription.closed) unlisten();
      else subscription.unlisten = unlisten;
      refresh();
    }, refresh);
    const poll = setInterval(refresh, 1500);

    return () => {
      subscription.closed = true;
      subscription.unlisten?.();
      clearInterval(poll);
    };
  }, []);

  return (
    <DesktopSessionContext.Provider value={session}>{children}</DesktopSessionContext.Provider>
  );
};
