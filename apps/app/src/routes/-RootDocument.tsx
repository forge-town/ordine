import { Outlet, HeadContent, Scripts } from "@tanstack/react-router";

export const RootDocument = () => {
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
