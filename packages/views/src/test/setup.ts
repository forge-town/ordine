import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../../../apps/app/src/locales/en.json";
import zh from "../../../../apps/app/src/locales/zh.json";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
