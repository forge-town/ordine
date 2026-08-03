import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Initialize i18n with zh locale forced for tests
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "@/locales/zh.json";
import en from "@/locales/en.json";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Node 22+ 会在全局预置一个不可用的 localStorage(未传 --localstorage-file 时
// 值为 undefined),导致 vitest 的 jsdom 环境跳过挂载(window === globalThis,
// 取不到 jsdom 原生实现)。测试环境用内存 Storage 顶替。
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

// Run cleanup after each test case (clears jsdom)
afterEach(() => {
  cleanup();
});
