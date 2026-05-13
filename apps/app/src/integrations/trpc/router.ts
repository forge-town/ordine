import { router } from "./init";
import { agentsRouter } from "./routers/agents";
import { agentRuntimesRouter } from "./routers/agentRuntimes";
import { distillationsRouter } from "./routers/distillations";
import { filesystemRouter } from "./routers/filesystem";
import { githubProjectsRouter } from "./routers/githubProjects";
import { jobsRouter } from "./routers/jobs";
import { operationsRouter } from "./routers/operations";
import { pipelinesRouter } from "./routers/pipelines";
import { recipesRouter } from "./routers/recipes";
import { refinementsRouter } from "./routers/refinements";
import { settingsRouter } from "./routers/settings";
import { skillsRouter } from "./routers/skills";
import { operationOutputItemTemplatesRouter } from "./routers/operationOutputItemTemplates";

export const appRouter = router({
  agents: agentsRouter,
  agentRuntimes: agentRuntimesRouter,
  filesystem: filesystemRouter,
  jobs: jobsRouter,
  operations: operationsRouter,
  pipelines: pipelinesRouter,
  settings: settingsRouter,
  githubProjects: githubProjectsRouter,
  skills: skillsRouter,
  recipes: recipesRouter,
  refinements: refinementsRouter,
  distillations: distillationsRouter,
  operationOutputItemTemplates: operationOutputItemTemplatesRouter,
});

export type AppRouter = typeof appRouter;
