import { createContext, useContext } from "react";
import type { DesktopStatus, DesktopCredentials } from "./server";

export const DesktopSessionContext = createContext<{
  status: DesktopStatus;
  credentials: DesktopCredentials | null;
} | null>(null);

export const useDesktopSession = () => {
  const value = useContext(DesktopSessionContext);
  if (!value) throw new Error("Desktop lifecycle provider is unavailable.");

  return value;
};

export const useDesktopCredentials = () => {
  const { credentials } = useDesktopSession();
  if (!credentials) throw new Error("The native execution session is not ready.");

  return credentials;
};
