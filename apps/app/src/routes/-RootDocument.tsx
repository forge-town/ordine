import { Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { themeInitializationScript } from "@/lib/themeInitialization";

export const RootDocument = () => {
  const { i18n } = useTranslation();

  return (
    <html suppressHydrationWarning lang={i18n.resolvedLanguage ?? i18n.language}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
};
