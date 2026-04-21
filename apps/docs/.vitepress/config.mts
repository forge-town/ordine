import { defineConfig } from "vitepress";
import type { DefaultTheme } from "vitepress";

export default defineConfig({
  title: "Ordine",
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      description: "AI-first meta-orchestration engine for automated workflows",
      themeConfig: {
        nav: enNav(),
        sidebar: enSidebar(),
      },
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      description: "AI 优先的自动化工作流元编排引擎",
      themeConfig: {
        nav: zhNav(),
        sidebar: zhSidebar(),
        outline: { label: "本页目录" },
        lastUpdated: { text: "最后更新" },
        docFooter: { prev: "上一篇", next: "下一篇" },
        darkModeSwitchLabel: "外观",
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "返回顶部",
      },
    },
  },

  themeConfig: {
    logo: "/logo.svg",

    socialLinks: [{ icon: "github", link: "https://github.com/nicepkg/ordine" }],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Ordine Contributors",
    },
  },
});

function enNav(): DefaultTheme.NavItem[] {
  return [
    { text: "Guide", link: "/guide/what-is-ordine" },
    { text: "API", link: "/api/rest" },
  ];
}

function enSidebar(): DefaultTheme.Sidebar {
  return {
    "/guide/": [
      {
        text: "Introduction",
        items: [
          { text: "What is Ordine?", link: "/guide/what-is-ordine" },
          { text: "Quick Start", link: "/guide/quick-start" },
          { text: "Core Concepts", link: "/guide/core-concepts" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Objects", link: "/guide/objects" },
          { text: "Operations", link: "/guide/operations" },
          { text: "Pipelines", link: "/guide/pipelines" },
          { text: "Skills", link: "/guide/skills" },
          { text: "Rules", link: "/guide/rules" },
          { text: "Jobs", link: "/guide/jobs" },
        ],
      },
    ],
    "/api/": [
      {
        text: "API Reference",
        items: [
          { text: "REST API", link: "/api/rest" },
          { text: "tRPC API", link: "/api/trpc" },
        ],
      },
    ],
  };
}

function zhNav(): DefaultTheme.NavItem[] {
  return [
    { text: "指南", link: "/zh/guide/what-is-ordine" },
    { text: "API", link: "/zh/api/rest" },
  ];
}

function zhSidebar(): DefaultTheme.Sidebar {
  return {
    "/zh/guide/": [
      {
        text: "介绍",
        items: [
          { text: "什么是 Ordine？", link: "/zh/guide/what-is-ordine" },
          { text: "快速开始", link: "/zh/guide/quick-start" },
          { text: "核心概念", link: "/zh/guide/core-concepts" },
        ],
      },
      {
        text: "概念",
        items: [
          { text: "对象", link: "/zh/guide/objects" },
          { text: "操作", link: "/zh/guide/operations" },
          { text: "流水线", link: "/zh/guide/pipelines" },
          { text: "技能", link: "/zh/guide/skills" },
          { text: "规则", link: "/zh/guide/rules" },
          { text: "任务", link: "/zh/guide/jobs" },
        ],
      },
    ],
    "/zh/api/": [
      {
        text: "API 参考",
        items: [
          { text: "REST API", link: "/zh/api/rest" },
          { text: "tRPC API", link: "/zh/api/trpc" },
        ],
      },
    ],
  };
}
