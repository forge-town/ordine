import { Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { getSavedLanguage, initialSavedLanguage } from "@/lib/i18n";

const LANGUAGE_HYDRATION_DELAY_MS = 500;

export const RootDocument = () => {
  const { i18n } = useTranslation();
  const initialI18n = useRef(i18n);

  useEffect(() => {
    const timeoutId = {
      current: undefined as ReturnType<typeof globalThis.setTimeout> | undefined,
    };
    const applySavedLanguage = () => {
      const savedLanguage = initialSavedLanguage ?? getSavedLanguage();
      const languageInstance = initialI18n.current;
      if (!savedLanguage || savedLanguage === languageInstance.resolvedLanguage) return;

      void languageInstance.changeLanguage(savedLanguage);
    };

    const scheduleSavedLanguage = () => {
      timeoutId.current = globalThis.setTimeout(applySavedLanguage, LANGUAGE_HYDRATION_DELAY_MS);
    };

    if (document.readyState === "complete") {
      scheduleSavedLanguage();

      return () => {
        if (timeoutId.current !== undefined) globalThis.clearTimeout(timeoutId.current);
      };
    }

    globalThis.addEventListener("load", scheduleSavedLanguage, { once: true });

    return () => {
      globalThis.removeEventListener("load", scheduleSavedLanguage);
      if (timeoutId.current !== undefined) globalThis.clearTimeout(timeoutId.current);
    };
  }, []);

  return (
    <html lang={i18n.resolvedLanguage ?? i18n.language}>
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
