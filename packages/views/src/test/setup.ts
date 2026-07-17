import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: {
        settings: {
          title: "设置",
          language: "语言",
          selectLanguage: "选择语言",
          timezone: "时区",
          saveChanges: "保存更改",
          saved: "已保存 ✓",
          sections: {
            language: "语言与地区",
            developer: "开发者",
          },
          developerSection: {
            title: "开发者",
            description: "本地开发环境的开发者模式设置",
            defaultAgentRuntime: "默认 Agent Runtime",
            defaultOutputPath: "默认输出路径前缀",
          },
        },
      },
    },
  },
  lng: "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
