import { useList } from "@refinedev/core";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { RuntimesPageStoreProvider } from "./_store";
import { RuntimesPageContent } from "./RuntimesPageContent";

export const RuntimesPage = () => {
  const { result: runtimesResult, query: runtimesQuery } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });

  if (runtimesQuery.isLoading || !runtimesResult) {
    return <RuntimesPageContent isLoading />;
  }

  return (
    <RuntimesPageStoreProvider initialRuntimes={runtimesResult.data ?? []}>
      <RuntimesPageContent isLoading={false} />
    </RuntimesPageStoreProvider>
  );
};
