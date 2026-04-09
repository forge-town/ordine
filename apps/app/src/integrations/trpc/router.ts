import { router } from "./init";
import { filesystemRouter } from "./routers/filesystem";
import { jobsRouter } from "./routers/jobs";
import { operationsRouter } from "./routers/operations";
import { pipelinesRouter } from "./routers/pipelines";
import { worksRouter } from "./routers/works";
import { rulesRouter } from "./routers/rules";
import { bestPracticesRouter } from "./routers/bestPractices";
import { githubProjectsRouter } from "./routers/githubProjects";
import { skillsRouter } from "./routers/skills";

export const appRouter = router({
  filesystem: filesystemRouter,
  jobs: jobsRouter,
  operations: operationsRouter,
  pipelines: pipelinesRouter,
  works: worksRouter,
  rules: rulesRouter,
  bestPractices: bestPracticesRouter,
  githubProjects: githubProjectsRouter,
  skills: skillsRouter,
});

export type AppRouter = typeof appRouter;
