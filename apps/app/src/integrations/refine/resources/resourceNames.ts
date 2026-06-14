/**
 * Refine 资源名常量（H3-03 自 dataProvider 迁出，避免 dataProvider ↔ registry 循环依赖）。
 * dataProvider.ts 再导出本常量，既有 `import { ResourceName } from ".../dataProvider"` 不受影响。
 */
export const ResourceName = {
  agents: "agents",
  agentRuntimes: "agentRuntimes",
  annotations: "annotations",
  connectors: "connectors",
  conversationMessages: "conversationMessages",
  filesystem: "filesystem",
  operations: "operations",
  pipelineAssets: "pipelineAssets",
  pipelines: "pipelines",
  projects: "projects",
  routines: "routines",
  jobs: "jobs",
  githubProjects: "githubProjects",
  skills: "skills",
  recipes: "recipes",
  checklistItems: "checklistItems",
  codeSnippets: "codeSnippets",
  skillDraftOperations: "skillDraftOperations",
  skillAnalyses: "skillAnalyses",
  distillations: "distillations",
  refinements: "refinements",
  settings: "settings",
  operationOutputItemTemplates: "operationOutputItemTemplates",
} as const;

export type ResourceNameValue = (typeof ResourceName)[keyof typeof ResourceName];
