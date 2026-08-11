import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { Result } from "neverthrow";

import en from "../locales/en.json";
import zh from "../locales/zh.json";

const resources = {
  en: { translation: en },
  zh: { translation: zh },
};

export const getSavedLanguage = (): string | undefined => {
  if (typeof globalThis === "undefined") return undefined;

  const ls = (
    globalThis as unknown as {
      localStorage?: { getItem?: (k: string) => string | null };
    }
  ).localStorage;

  if (ls && typeof ls.getItem === "function") {
    const safeGetItem = Result.fromThrowable(
      (key: string) => ls.getItem!(key),
      () => null,
    );
    const result = safeGetItem("i18nextLng");

    return (result.isOk() ? result.value : null) ?? getCookie("i18next");
  }

  return getCookie("i18next");
};

const getCookie = (name: string): string | undefined => {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();

  return undefined;
};

export const initialSavedLanguage = getSavedLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Keep the server render and the first client render identical. The saved
    // browser preference is applied by RootDocument after hydration. Capture
    // it above before LanguageDetector caches the deterministic initial value.
    lng: "zh",
    fallbackLng: "zh",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
      lookupCookie: "i18next",
    },
    react: {
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ["br", "i", "p", "span", "strong"],
    },
  });

export default i18n;
