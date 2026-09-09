import { Refine } from "@refinedev/core";
import { useState, type FC, type PropsWithChildren } from "react";
import { PlatformProvider } from "@repo/views/platform";
import { AuthProvider } from "@repo/views/auth";
import { dataProvider } from "./dataProvider";
import { notificationProvider } from "./notificationProvider";
import { webPlatform } from "../platform";
import { webAuth } from "../auth";
import { GlobalAgentControlProvider } from "@repo/views/GlobalAgentControl";
import { createWebExecutionDataProvider } from "./executionDataProvider";

export const RefineProvider: FC<PropsWithChildren> = ({ children }) => {
  const [executionDataProvider] = useState(createWebExecutionDataProvider);

  return (
    <Refine
      dataProvider={{ default: dataProvider, execution: executionDataProvider }}
      notificationProvider={notificationProvider}
      options={{ disableTelemetry: true }}
    >
      <PlatformProvider value={webPlatform}>
        <GlobalAgentControlProvider>
          <AuthProvider value={webAuth}>{children}</AuthProvider>
        </GlobalAgentControlProvider>
      </PlatformProvider>
    </Refine>
  );
};
