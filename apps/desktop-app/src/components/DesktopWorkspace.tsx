import { useMemo, useState } from "react";
import { Refine } from "@refinedev/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlatformProvider } from "@repo/views/platform";
import { GlobalAgentControlProvider } from "@repo/views/GlobalAgentControl";
import { createExecutionDataProvider } from "@repo/views/execution";
import { useDesktopCredentials } from "../integrations/sidecar/DesktopSessionContext";
import { createDesktopPlatform, createDesktopRequest } from "../integrations/platform";
import { DesktopWorkspaceContent } from "./DesktopWorkspaceContent";
import { createDesktopAuthoringDataProvider } from "../integrations/refine/dataProvider";

export const DesktopWorkspace = () => {
  const credentials = useDesktopCredentials();
  const [queryClient] = useState(() => new QueryClient());
  const provider = useMemo(
    () =>
      createExecutionDataProvider({
        baseUrl: credentials.baseUrl,
        fetcher: createDesktopRequest({
          baseUrl: credentials.baseUrl,
          appToken: credentials.appToken,
        }),
        getHeaders: () => ({
          "X-Desktop-Token": credentials.appToken,
          "X-Ordine-Api-Version": "2",
        }),
      }),
    [credentials.baseUrl, credentials.appToken],
  );
  const platform = useMemo(
    () => createDesktopPlatform({ baseUrl: credentials.baseUrl, appToken: credentials.appToken }),
    [credentials.baseUrl, credentials.appToken],
  );
  const authoringProvider = useMemo(
    () =>
      createDesktopAuthoringDataProvider({
        baseUrl: credentials.baseUrl,
        request: platform.request,
      }),
    [credentials.baseUrl, platform.request],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Refine
        dataProvider={{ default: authoringProvider, execution: provider }}
        options={{ disableTelemetry: true }}
      >
        <PlatformProvider value={platform}>
          <GlobalAgentControlProvider>
            <DesktopWorkspaceContent />
          </GlobalAgentControlProvider>
        </PlatformProvider>
      </Refine>
    </QueryClientProvider>
  );
};
