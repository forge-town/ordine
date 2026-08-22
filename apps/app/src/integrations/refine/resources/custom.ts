import { trpcClient } from "@/integrations/trpc/client";

export const CustomEndpoint = {
  pipelinesRun: "pipelines/run",
  pipelinesCancel: "pipelines/cancel",
  pipelinesAnalyzeIntent: "pipelines/analyzeIntent",
  pipelinesGenerateStructure: "pipelines/generateStructure",
  pipelinesOptimizeFromDistillation: "pipelines/optimizeFromDistillation",
  pipelinesProposeActions: "pipelines/proposeActions",
  connectorsConnect: "connectors/connect",
  conversationsClearAll: "conversations/clearAll",
  pipelineAssetsGetUsageCount: "pipelineAssets/getUsageCount",
  pipelineAssetsIncrementRunStats: "pipelineAssets/incrementRunStats",
  pipelineAssetsDistillFromPipeline: "pipelineAssets/distillFromPipeline",
  routinesRunNow: "routines/runNow",
  routinesOccurrences: "routines/occurrences",
  usageSummary: "usage/summary",
  usageDailyTokenSeries: "usage/dailyTokenSeries",
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
  agentRuntimesGetCatalog: "agentRuntimes/getCatalog",
  agentRuntimesRescanCatalog: "agentRuntimes/rescanCatalog",
  agentRuntimesSyncAll: "agentRuntimes/syncAll",
  agentRuntimesScanAndSync: "agentRuntimes/scanAndSync",
  operationsRun: "operations/run",
  skillsPreviewImport: "skills/previewImport",
  skillsImportCandidates: "skills/importCandidates",
} as const;

type CustomHandler = (payload: unknown) => Promise<unknown>;
type Input<T extends (...args: never[]) => unknown> = Parameters<T>[0];

export const customEndpoints: Record<string, CustomHandler> = {
  [CustomEndpoint.pipelinesRun]: (payload) =>
    trpcClient.pipelines.run.mutate(payload as Input<typeof trpcClient.pipelines.run.mutate>),
  [CustomEndpoint.pipelinesCancel]: (payload) =>
    trpcClient.pipelines.cancel.mutate(payload as Input<typeof trpcClient.pipelines.cancel.mutate>),
  [CustomEndpoint.pipelinesAnalyzeIntent]: (payload) =>
    trpcClient.pipelines.analyzeIntent.mutate(
      payload as Input<typeof trpcClient.pipelines.analyzeIntent.mutate>,
    ),
  [CustomEndpoint.pipelinesGenerateStructure]: (payload) =>
    trpcClient.pipelines.generateStructure.mutate(
      payload as Input<typeof trpcClient.pipelines.generateStructure.mutate>,
    ),
  [CustomEndpoint.pipelinesOptimizeFromDistillation]: (payload) =>
    trpcClient.pipelines.optimizeFromDistillation.mutate(
      payload as Input<typeof trpcClient.pipelines.optimizeFromDistillation.mutate>,
    ),
  [CustomEndpoint.pipelinesProposeActions]: (payload) =>
    trpcClient.pipelines.proposeActions.mutate(
      payload as Input<typeof trpcClient.pipelines.proposeActions.mutate>,
    ),
  [CustomEndpoint.connectorsConnect]: (payload) =>
    trpcClient.connectors.connect.mutate(
      payload as Input<typeof trpcClient.connectors.connect.mutate>,
    ),
  [CustomEndpoint.conversationsClearAll]: () => trpcClient.conversations.clearAll.mutate(),
  [CustomEndpoint.pipelineAssetsGetUsageCount]: (payload) =>
    trpcClient.pipelineAssets.getUsageCount.query(
      payload as Input<typeof trpcClient.pipelineAssets.getUsageCount.query>,
    ),
  [CustomEndpoint.pipelineAssetsIncrementRunStats]: (payload) =>
    trpcClient.pipelineAssets.incrementRunStats.mutate(
      payload as Input<typeof trpcClient.pipelineAssets.incrementRunStats.mutate>,
    ),
  [CustomEndpoint.pipelineAssetsDistillFromPipeline]: (payload) =>
    trpcClient.pipelineAssets.distillFromPipeline.mutate(
      payload as Input<typeof trpcClient.pipelineAssets.distillFromPipeline.mutate>,
    ),
  [CustomEndpoint.routinesRunNow]: (payload) =>
    trpcClient.routines.runNow.mutate(payload as Input<typeof trpcClient.routines.runNow.mutate>),
  [CustomEndpoint.routinesOccurrences]: (payload) =>
    trpcClient.routines.getOccurrences.query(
      payload as Input<typeof trpcClient.routines.getOccurrences.query>,
    ),
  [CustomEndpoint.usageSummary]: (payload) =>
    trpcClient.usage.getSummary.query(payload as Input<typeof trpcClient.usage.getSummary.query>),
  [CustomEndpoint.usageDailyTokenSeries]: (payload) =>
    trpcClient.usage.getDailyTokenSeries.query(
      payload as Input<typeof trpcClient.usage.getDailyTokenSeries.query>,
    ),
  [CustomEndpoint.usageByPipeline]: (payload) =>
    trpcClient.usage.getByPipeline.query(
      payload as Input<typeof trpcClient.usage.getByPipeline.query>,
    ),
  [CustomEndpoint.usageByAgent]: (payload) =>
    trpcClient.usage.getByAgent.query(payload as Input<typeof trpcClient.usage.getByAgent.query>),
  [CustomEndpoint.jobsAnalysis]: async (payload) => {
    const { jobId } = payload as { jobId: string };
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
  [CustomEndpoint.jobsTraces]: async (payload) => {
    const { jobId } = payload as { jobId: string };

    return { traces: await trpcClient.jobs.getTraces.query({ jobId }) };
  },
  [CustomEndpoint.jobsPause]: (payload) =>
    trpcClient.jobs.pause.mutate(payload as Input<typeof trpcClient.jobs.pause.mutate>),
  [CustomEndpoint.jobsCancel]: (payload) =>
    trpcClient.jobs.cancel.mutate(payload as Input<typeof trpcClient.jobs.cancel.mutate>),
  [CustomEndpoint.jobsResume]: (payload) =>
    trpcClient.jobs.resume.mutate(payload as Input<typeof trpcClient.jobs.resume.mutate>),
  [CustomEndpoint.jobsAgentRuns]: async (payload) => {
    const { jobId } = payload as { jobId: string };

    return { agentRuns: await trpcClient.jobs.getAgentRuns.query({ jobId }) };
  },
  [CustomEndpoint.jobsAgentRunSpans]: async (payload) => {
    const { rawExportId } = payload as { rawExportId: number };

    return { spans: await trpcClient.jobs.getAgentRunSpans.query({ rawExportId }) };
  },
  [CustomEndpoint.refinementsStart]: (payload) =>
    trpcClient.refinements.start.mutate(
      payload as Input<typeof trpcClient.refinements.start.mutate>,
    ),
  [CustomEndpoint.distillationsRun]: (payload) =>
    trpcClient.distillations.run.mutate(
      payload as Input<typeof trpcClient.distillations.run.mutate>,
    ),
  [CustomEndpoint.settingsScanRuntimes]: () => trpcClient.agentRuntimes.scanRuntimes.query(),
  [CustomEndpoint.agentRuntimesGetCatalog]: () => trpcClient.agentRuntimes.getCatalog.query(),
  [CustomEndpoint.agentRuntimesRescanCatalog]: () =>
    trpcClient.agentRuntimes.rescanCatalog.mutate(),
  [CustomEndpoint.agentRuntimesSyncAll]: (payload) =>
    trpcClient.agentRuntimes.syncAll.mutate(
      payload as Input<typeof trpcClient.agentRuntimes.syncAll.mutate>,
    ),
  [CustomEndpoint.agentRuntimesScanAndSync]: () => trpcClient.agentRuntimes.scanAndSync.mutate(),
  [CustomEndpoint.operationsRun]: (payload) =>
    trpcClient.operations.run.mutate(payload as Input<typeof trpcClient.operations.run.mutate>),
  [CustomEndpoint.skillsPreviewImport]: (payload) =>
    trpcClient.skills.previewImport.query(
      payload as Input<typeof trpcClient.skills.previewImport.query>,
    ),
  [CustomEndpoint.skillsImportCandidates]: (payload) =>
    trpcClient.skills.importCandidates.mutate(
      payload as Input<typeof trpcClient.skills.importCandidates.mutate>,
    ),
};
