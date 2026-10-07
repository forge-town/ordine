import type { CanvasControlBindings } from "../../contracts";
export const createCanvasControlResolveSnapshotHelper =
  (serviceBindings: Pick<CanvasControlBindings, "pipelinesDao" | "changeSetsDao">) =>
  async ({
    pipelineId,
    threadId,
    changeSetId,
  }: {
    pipelineId: string;
    threadId?: string | null;
    changeSetId?: string;
  }) => {
    const pipeline = await serviceBindings.pipelinesDao.findById(pipelineId);
    if (!pipeline) return null;
    const explicit = changeSetId ? await serviceBindings.changeSetsDao.findById(changeSetId) : null;
    const active =
      explicit ??
      (threadId
        ? await serviceBindings.changeSetsDao.findActive(threadId, "pipeline", pipelineId)
        : null);
    const changeSet =
      active &&
      active.threadId === threadId &&
      active.targetType === "pipeline" &&
      active.targetId === pipelineId
        ? active
        : null;

    return {
      pipeline,
      changeSet,
      snapshot: changeSet?.draftSnapshot ?? { nodes: pipeline.nodes, edges: pipeline.edges },
    };
  };
