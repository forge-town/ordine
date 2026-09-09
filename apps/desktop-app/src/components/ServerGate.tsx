import type { ReactNode } from "react";
import { DesktopLifecycleProvider } from "./DesktopLifecycleProvider";
import { ServerGateContent } from "./ServerGateContent";

export const ServerGate = ({ children }: { children: ReactNode }) => (
  <DesktopLifecycleProvider>
    <ServerGateContent>{children}</ServerGateContent>
  </DesktopLifecycleProvider>
);
