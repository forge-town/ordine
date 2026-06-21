import { trpcClient } from "@/integrations/trpc/client";

/**
 * dataProvider.custom 的 URL → handler 注册表（H3-03）。
 * 逐条等价迁移自原 custom 方法的 if 链；URL 字面量集中为 CustomEndpoint 常量，
 * 调用方可引用常量而非裸字符串（消除约定式字符串路由）。
 */

/** 所有 custom 端点的 URL 常量（按域分组）。 */
export const CustomEndpoint = {
  pipelinesRun: "pipelines/run",
  pipelinesAnalyzeIntent: "pipelines/analyzeIntent",
  pipelinesGenerateStructure: "pipelines/generateStructure",
  pipelinesOptimizeFromDistillation: "pipelines/optimizeFromDistillation",
  pipelinesCreatePendingOperations: "pipelines/createPendingOperations",
  pipelinesProposeProgress: "pipelines/proposeProgress",
  pipelinesProposeActions: "pipelines/proposeActions",
  conversationsClearAll: "conversations/clearAll",
  pipelineAssetsGetUsageCount: "pipelineAssets/getUsageCount",
  usageSummary: "usage/summary",
  usageDailyCost: "usage/dailyCost",
  usageByPipeline: "usage/byPipeline",
  usageByAgent: "usage/byAgent",
  jobsAnalysis: "jobs/analysis",
  jobsTraces: "jobs/traces",
  jobsPause: "jobs/pause",
  jobsCancel: "jobs/cancel",
  jobsResume: "jobs/resume",
  jobsAgentRuns: "jobs/agentRuns",
  jobsAgentRunSpans: "jobs/agentRunSpans",
  refinementsStart: "refinements/start",
  distillationsRun: "distillations/run",
  settingsScanRuntimes: "settings/scanRuntimes",
  agentRuntimesSyncAll: "agentRuntimes/syncAll",
  agentRuntimesScanAndSync: "agentRuntimes/scanAndSync",
  operationsRun: "operations/run",
  skillsPreviewImport: "skills/previewImport",
  skillsImportCandidates: "skills/importCandidates",
} as const;

type CustomHandler = (payload: unknown) => Promise<unknown>;
type Args<T extends (...args: never[]) => unknown> = Parameters<T>[0];

export const customEndpoints: Record<string, CustomHandler> = {
  [CustomEndpoint.pipelinesRun]: (p) =>
    trpcClient.pipelines.run.mutate(p as Args<typeof trpcClient.pipelines.run.mutate>),
  [CustomEndpoint.pipelinesAnalyzeIntent]: (p) =>
    trpcClient.pipelines.analyzeIntent.mutate(
      p as Args<typeof trpcClient.pipelines.analyzeIntent.mutate>,
    ),
  [CustomEndpoint.pipelinesGenerateStructure]: (p) =>
    trpcClient.pipelines.generateStructure.mutate(
      p as Args<typeof trpcClient.pipelines.generateStructure.mutate>,
    ),
  [CustomEndpoint.pipelinesOptimizeFromDistillation]: (p) =>
    trpcClient.pipelines.optimizeFromDistillation.mutate(
      p as Args<typeof trpcClient.pipelines.optimizeFromDistillation.mutate>,
    ),
  [CustomEndpoint.pipelinesCreatePendingOperations]: (p) =>
    trpcClient.pipelines.createPendingOperations.mutate(
      p as Args<typeof trpcClient.pipelines.createPendingOperations.mutate>,
    ),
  [CustomEndpoint.pipelinesProposeProgress]: (p) =>
    trpcClient.pipelines.proposeProgress.query(
      p as Args<typeof trpcClient.pipelines.proposeProgress.query>,
    ),
  [CustomEndpoint.pipelinesProposeActions]: (p) =>
    trpcClient.pipelines.proposeActions.mutate(
      p as Args<typeof trpcClient.pipelines.proposeActions.mutate>,
    ),
  [CustomEndpoint.conversationsClearAll]: () => trpcClient.conversations.clearAll.mutate(),
  [CustomEndpoint.pipelineAssetsGetUsageCount]: (p) =>
    trpcClient.pipelineAssets.getUsageCount.query({ id: (p as { id: string }).id }),
  [CustomEndpoint.usageSummary]: (p) =>
    trpcClient.usage.getSummary.query(p as Args<typeof trpcClient.usage.getSummary.query>),
  [CustomEndpoint.usageDailyCost]: (p) =>
    trpcClient.usage.getDailyCostSeries.query(
      p as Args<typeof trpcClient.usage.getDailyCostSeries.query>,
    ),
  [CustomEndpoint.usageByPipeline]: (p) =>
    trpcClient.usage.getByPipeline.query(p as Args<typeof trpcClient.usage.getByPipeline.query>),
  [CustomEndpoint.usageByAgent]: (p) =>
    trpcClient.usage.getByAgent.query(p as Args<typeof trpcClient.usage.getByAgent.query>),
  [CustomEndpoint.jobsAnalysis]: async (p) => {
    const { jobId } = p as { jobId: string };
    const [traces, agentRuns] = await Promise.all([
      trpcClient.jobs.getTraces.query({ jobId }),
      trpcClient.jobs.getAgentRuns.query({ jobId }),
    ]);
    const spansByRunEntries = await Promise.all(
      agentRuns.map(async (run) => {
        const spans = await trpcClient.jobs.getAgentRunSpans.query({ rawExportId: run.id });

        return [run.id, spans] as const;
      }),
    );

    return { traces, agentRuns, spansByRun: Object.fromEntries(spansByRunEntries) };
  },
  [CustomEndpoint.jobsTraces]: async (p) => {
    const { jobId } = p as { jobId: string };
    const traces = await trpcClient.jobs.getTraces.query({ jobId });

    return { traces };
  },
  [CustomEndpoint.jobsPause]: (p) =>
    trpcClient.jobs.pause.mutate(p as Args<typeof trpcClient.jobs.pause.mutate>),
  [CustomEndpoint.jobsCancel]: (p) =>
    trpcClient.jobs.cancel.mutate(p as Args<typeof trpcClient.jobs.cancel.mutate>),
  [CustomEndpoint.jobsResume]: (p) =>
    trpcClient.jobs.resume.mutate(p as Args<typeof trpcClient.jobs.resume.mutate>),
  [CustomEndpoint.jobsAgentRuns]: async (p) => {
    const { jobId } = p as { jobId: string };
    const agentRuns = await trpcClient.jobs.getAgentRuns.query({ jobId });

    return { agentRuns };
  },
  [CustomEndpoint.jobsAgentRunSpans]: async (p) => {
    const { rawExportId } = p as { rawExportId: number };
    const spans = await trpcClient.jobs.getAgentRunSpans.query({ rawExportId });

    return { spans };
  },
  [CustomEndpoint.refinementsStart]: (p) =>
    trpcClient.refinements.start.mutate(p as Args<typeof trpcClient.refinements.start.mutate>),
  [CustomEndpoint.distillationsRun]: (p) =>
    trpcClient.distillations.run.mutate(p as Args<typeof trpcClient.distillations.run.mutate>),
  [CustomEndpoint.settingsScanRuntimes]: () => trpcClient.agentRuntimes.scanRuntimes.query(),
  [CustomEndpoint.agentRuntimesSyncAll]: (p) =>
    trpcClient.agentRuntimes.syncAll.mutate(
      p as Args<typeof trpcClient.agentRuntimes.syncAll.mutate>,
    ),
  [CustomEndpoint.agentRuntimesScanAndSync]: () => trpcClient.agentRuntimes.scanAndSync.mutate(),
  [CustomEndpoint.operationsRun]: (p) =>
    trpcClient.operations.run.mutate(p as Args<typeof trpcClient.operations.run.mutate>),
  [CustomEndpoint.skillsPreviewImport]: (p) =>
    trpcClient.skills.previewImport.query(p as Args<typeof trpcClient.skills.previewImport.query>),
  [CustomEndpoint.skillsImportCandidates]: (p) =>
    trpcClient.skills.importCandidates.mutate(
      p as Args<typeof trpcClient.skills.importCandidates.mutate>,
    ),
};
