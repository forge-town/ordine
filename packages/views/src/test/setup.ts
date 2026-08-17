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

// Node 22+ exposes an unusable global localStorage unless --localstorage-file is set.
// Keep shared views tests deterministic with the same in-memory implementation as app tests.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
