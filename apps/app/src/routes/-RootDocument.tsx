import { Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeApplier } from "@/store/themeStore";

export const RootDocument = () => {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeApplier />
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
};
