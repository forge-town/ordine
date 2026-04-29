import { useOne } from "@refinedev/core";
import type { Settings } from "@repo/schemas";
import { RuntimesPageStoreProvider } from "./_store";
import { RuntimesPageContent } from "./RuntimesPageContent";

export const RuntimesPage = () => {
  const { result: settingsResult, query: settingsQuery } = useOne<Settings>({
    resource: "settings",
    id: "default",
  });

  return (
    <RuntimesPageStoreProvider initialRuntimes={settingsResult?.agentRuntimes ?? []}>
      <RuntimesPageContent isLoading={settingsQuery.isLoading} />
    </RuntimesPageStoreProvider>
  );
};
