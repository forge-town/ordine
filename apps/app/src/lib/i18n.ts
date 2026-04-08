import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import zh from "../locales/zh.json";

const resources = {
  en: { translation: en },
  zh: { translation: zh },
};

const getSavedLanguage = (): string | undefined => {
  if (typeof globalThis === "undefined") return undefined;

  const ls = (
    globalThis as unknown as {
      localStorage?: { getItem?: (k: string) => string | null };
    }
  ).localStorage;

  if (ls && typeof ls.getItem === "function") {
    try {
      return ls.getItem("i18nextLng") ?? getCookie("i18next");
    } catch {
      return getCookie("i18next");
    }
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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage() ?? undefined,
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
