import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Initialize i18n with zh locale forced for tests
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "@/locales/zh.json";

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh } },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Run cleanup after each test case (clears jsdom)
afterEach(() => {
  cleanup();
});
