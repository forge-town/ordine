import { AgentControlToolResultSchema } from "@repo/schemas";

import type { AgentControlServiceBindings } from "../../contracts";
export const createGetCanvasRunCompletionMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "actionsDao" | "changeSetsDao">,
) =>
  ({
    async getCanvasRunCompletion(runId: string) {
      const actions = await serviceBindings.actionsDao.findManyByRunId(runId);
      const changeSetIds = [
        ...new Set(
          actions
            .filter(
              (action) =>
                action.risk === "draft" &&
                action.toolName !== "ordine.finish_canvas_edit" &&
                action.status === "succeeded",
            )
            .map((action) => action.changeSetId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const changeSets = (
        await Promise.all(
          changeSetIds.map((changeSetId) => serviceBindings.changeSetsDao.findById(changeSetId)),
        )
      ).filter((changeSet): changeSet is NonNullable<typeof changeSet> => Boolean(changeSet));
      const finishedIds = new Set(
        actions
          .filter(
            (action) =>
              action.toolName === "ordine.finish_canvas_edit" && action.status === "succeeded",
          )
          .map((action) => {
            const parsed = AgentControlToolResultSchema.safeParse(action.result);

            return parsed.success && typeof parsed.data.data?.changeSetId === "string"
              ? parsed.data.data.changeSetId
              : null;
          })
          .filter((id): id is string => Boolean(id)),
      );
      const complete = changeSets.every(
        (changeSet) =>
          finishedIds.has(changeSet.id) ||
          ["ready", "committed", "reverted"].includes(changeSet.status),
      );

      return {
        hasCanvasMutations: changeSetIds.length > 0,
        complete,
        changeSetIds,
      };
    },
  }).getCanvasRunCompletion;
