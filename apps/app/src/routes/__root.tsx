import { createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import "@/lib/i18n";
import "@/plugins/init";
import { NotFound } from "./-NotFound";
import { RootDocument } from "./-RootDocument";

export const Route = createRootRoute({
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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
