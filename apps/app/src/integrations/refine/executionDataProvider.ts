import { createExecutionDataProvider } from "@repo/views/execution";

export const createWebExecutionDataProvider = () =>
  createExecutionDataProvider({
    baseUrl: globalThis.window?.location.origin ?? "http://localhost:9430",
    getHeaders: () => ({}),
    fetcher: (input, init) => fetch(input, { ...init, credentials: "same-origin" }),
  });
