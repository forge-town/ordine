export const SidebarView = {
  Main: "main",
  Pipeline: "pipeline",
} as const;

export type SidebarViewType = (typeof SidebarView)[keyof typeof SidebarView];
