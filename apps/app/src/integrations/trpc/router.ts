import { router } from "./init";
import { agentsRouter } from "./routers/agents";
import { agentRuntimesRouter } from "./routers/agentRuntimes";
import { artifactsRouter } from "./routers/artifacts";
import { annotationsRouter } from "./routers/annotations";
import { connectorsRouter } from "./routers/connectors";
import { conversationsRouter } from "./routers/conversations";
import { distillationsRouter } from "./routers/distillations";
import { filesystemRouter } from "./routers/filesystem";
import { githubProjectsRouter } from "./routers/githubProjects";
import { jobsRouter } from "./routers/jobs";
import { pipelineAssetsRouter } from "./routers/pipelineAssets";
import { operationsRouter } from "./routers/operations";
import { pipelinesRouter } from "./routers/pipelines";
import { projectsRouter } from "./routers/projects";
import { refinementsRouter } from "./routers/refinements";
import { routinesRouter } from "./routers/routines";
import { settingsRouter } from "./routers/settings";
import { skillsRouter } from "./routers/skills";
import { operationOutputItemTemplatesRouter } from "./routers/operationOutputItemTemplates";
import { usageRouter } from "./routers/usage";

export const appRouter = router({
  agents: agentsRouter,
  agentRuntimes: agentRuntimesRouter,
  artifacts: artifactsRouter,
  annotations: annotationsRouter,
  connectors: connectorsRouter,
  conversations: conversationsRouter,
  filesystem: filesystemRouter,
  jobs: jobsRouter,
  operations: operationsRouter,
  pipelineAssets: pipelineAssetsRouter,
  pipelines: pipelinesRouter,
  projects: projectsRouter,
  settings: settingsRouter,
  githubProjects: githubProjectsRouter,
  skills: skillsRouter,
  refinements: refinementsRouter,
  routines: routinesRouter,
  distillations: distillationsRouter,
  operationOutputItemTemplates: operationOutputItemTemplatesRouter,
  usage: usageRouter,
});

export type AppRouter = typeof appRouter;
