import { router } from "./init";
import { bestPracticesRouter } from "./routers/bestPractices";
import { checklistRouter } from "./routers/checklist";
import { codeSnippetsRouter } from "./routers/codeSnippets";
import { distillationsRouter } from "./routers/distillations";
import { filesystemRouter } from "./routers/filesystem";
import { githubProjectsRouter } from "./routers/githubProjects";
import { jobsRouter } from "./routers/jobs";
import { operationsRouter } from "./routers/operations";
import { pipelinesRouter } from "./routers/pipelines";
import { recipesRouter } from "./routers/recipes";
import { rulesRouter } from "./routers/rules";
import { settingsRouter } from "./routers/settings";
import { skillsRouter } from "./routers/skills";

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
  distillations: distillationsRouter,
});

export type AppRouter = typeof appRouter;
