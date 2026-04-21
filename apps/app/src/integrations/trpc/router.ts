import { router } from "./init";
import { filesystemRouter } from "./routers/filesystem";
import { jobsRouter } from "./routers/jobs";
import { operationsRouter } from "./routers/operations";
import { pipelinesRouter } from "./routers/pipelines";
import { settingsRouter } from "./routers/settings";
import { rulesRouter } from "./routers/rules";
import { bestPracticesRouter } from "./routers/bestPractices";
import { githubProjectsRouter } from "./routers/githubProjects";
import { skillsRouter } from "./routers/skills";
import { recipesRouter } from "./routers/recipes";
import { checklistRouter } from "./routers/checklist";
import { codeSnippetsRouter } from "./routers/codeSnippets";

export const appRouter = router({
  filesystem: filesystemRouter,
  jobs: jobsRouter,
  operations: operationsRouter,
  pipelines: pipelinesRouter,
  settings: settingsRouter,
  rules: rulesRouter,
  bestPractices: bestPracticesRouter,
  githubProjects: githubProjectsRouter,
  skills: skillsRouter,
  recipes: recipesRouter,
  checklist: checklistRouter,
  codeSnippets: codeSnippetsRouter,
});

export type AppRouter = typeof appRouter;
