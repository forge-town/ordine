import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
};

const browserState: { queryClient: QueryClient | undefined } = { queryClient: undefined };

const getQueryClient = () => {
  if (typeof globalThis === "undefined") {
    return makeQueryClient();
  }
  if (!browserState.queryClient) {
    browserState.queryClient = makeQueryClient();
  }
  return browserState.queryClient;
};

interface ProviderProps {
  children: ReactNode;
}

export const Provider = ({ children }: ProviderProps) => {
  const [queryClient] = useState(() => getQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
