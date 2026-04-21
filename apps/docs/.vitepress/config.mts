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
      copyright: "Copyright © 2026 Code Forge AI",
    },
  },
});

function enNav(): DefaultTheme.NavItem[] {
  return [
    { text: "Guide", link: "/guide/what-is-ordine" },
    { text: "Skills", link: "/skills/" },
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
    "/skills/": [
      {
        text: "Getting Started",
        items: [
          { text: "Overview", link: "/skills/" },
          { text: "Quick Start", link: "/skills/ordine-quickstart" },
          { text: "List Entities", link: "/skills/ordine-list-entities" },
          { text: "List Pipelines", link: "/skills/ordine-list-pipelines" },
        ],
      },
      {
        text: "Create",
        items: [
          { text: "Create Operation", link: "/skills/ordine-create-operation" },
          { text: "Create Pipeline", link: "/skills/ordine-create-pipeline" },
          { text: "Create Skill", link: "/skills/ordine-create-skill" },
          { text: "Create Best Practice", link: "/skills/ordine-create-bestpractice" },
          { text: "Create Recipe", link: "/skills/ordine-create-recipe" },
          { text: "Create Rule", link: "/skills/ordine-create-rule" },
          { text: "Create Project", link: "/skills/ordine-create-project" },
        ],
      },
      {
        text: "Execute & Monitor",
        items: [
          { text: "Run Pipeline", link: "/skills/ordine-run-pipeline" },
          { text: "Manage Jobs", link: "/skills/ordine-manage-job" },
          { text: "Browse Traces", link: "/skills/ordine-browse-traces" },
        ],
      },
      {
        text: "Manage Content",
        items: [
          { text: "Browse Filesystem", link: "/skills/ordine-browse-filesystem" },
          { text: "Manage Checklist", link: "/skills/ordine-manage-checklist" },
          { text: "Manage Code Snippets", link: "/skills/ordine-manage-codesnippet" },
          { text: "Export & Import", link: "/skills/ordine-export-import" },
        ],
      },
    ],
  };
}

function zhNav(): DefaultTheme.NavItem[] {
  return [
    { text: "指南", link: "/zh/guide/what-is-ordine" },
    { text: "Skills", link: "/zh/skills/" },
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
    "/zh/skills/": [
      {
        text: "入门",
        items: [
          { text: "概览", link: "/zh/skills/" },
          { text: "快速上手", link: "/zh/skills/ordine-quickstart" },
          { text: "列出实体", link: "/zh/skills/ordine-list-entities" },
          { text: "列出流水线", link: "/zh/skills/ordine-list-pipelines" },
        ],
      },
      {
        text: "创建",
        items: [
          { text: "创建操作", link: "/zh/skills/ordine-create-operation" },
          { text: "创建流水线", link: "/zh/skills/ordine-create-pipeline" },
          { text: "创建技能", link: "/zh/skills/ordine-create-skill" },
          { text: "创建最佳实践", link: "/zh/skills/ordine-create-bestpractice" },
          { text: "创建配方", link: "/zh/skills/ordine-create-recipe" },
          { text: "创建规则", link: "/zh/skills/ordine-create-rule" },
          { text: "创建项目", link: "/zh/skills/ordine-create-project" },
        ],
      },
      {
        text: "执行与监控",
        items: [
          { text: "运行流水线", link: "/zh/skills/ordine-run-pipeline" },
          { text: "管理任务", link: "/zh/skills/ordine-manage-job" },
          { text: "浏览追踪", link: "/zh/skills/ordine-browse-traces" },
        ],
      },
      {
        text: "内容管理",
        items: [
          { text: "浏览文件系统", link: "/zh/skills/ordine-browse-filesystem" },
          { text: "管理检查清单", link: "/zh/skills/ordine-manage-checklist" },
          { text: "管理代码片段", link: "/zh/skills/ordine-manage-codesnippet" },
          { text: "导出与导入", link: "/zh/skills/ordine-export-import" },
        ],
      },
    ],
  };
}
