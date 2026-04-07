import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

const NotFound = () => (
  <div className="flex h-screen items-center justify-center text-muted-foreground">
    <p>404 — 页面不存在</p>
  </div>
);

const RootDocument = () => {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
};

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
