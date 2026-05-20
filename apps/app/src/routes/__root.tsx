import { createRootRouteWithContext } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import appCss from "../styles.css?url";
import "@/lib/i18n";
import "@/plugins/init";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";
import { NotFound } from "./-NotFound";
import { RootDocument } from "./-RootDocument";

const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  const { ORDINE_LOCAL_MODE } = getServerEnv();

  return { session, isLocalMode: ORDINE_LOCAL_MODE };
});

export type RouterContext = {
  session: Awaited<ReturnType<typeof fetchSession>>["session"];
  isLocalMode: boolean;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const { session, isLocalMode } = await fetchSession();

    return { session, isLocalMode };
  },
  head: () => ({
    meta: [
      { charSet: "utf8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ordine" },
      {
        name: "description",
        content: "Ordine — AI 驱动的 Skill Pipeline 设计平台",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),

  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
