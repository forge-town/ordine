import { useUpdate, type HttpError } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { PipelineData, PipelineGraphSnapshot } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";

const SAVE_DELAY_MS = 400;

type PendingSave = {
  snapshot: PipelineGraphSnapshot;
  timeout: ReturnType<typeof setTimeout>;
  update: (snapshot: PipelineGraphSnapshot) => Promise<unknown>;
};

const pendingSaves = new Map<string, PendingSave>();
const saveQueues = new Map<string, Promise<unknown>>();

const enqueueSave = (pipelineId: string, save: () => Promise<unknown>) => {
  const previous = saveQueues.get(pipelineId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(save);
  saveQueues.set(pipelineId, next);
  void next
    .finally(() => {
      if (saveQueues.get(pipelineId) === next) {
        saveQueues.delete(pipelineId);
      }
    })
    .catch(() => undefined);
};

export const usePipelineSnapshotPersistence = (pipelineId: string) => {
  const { t } = useTranslation();
  const { mutateAsync: updatePipeline } = useUpdate<
    PipelineData,
    HttpError,
    Partial<PipelineData>
  >();

  return (snapshot: PipelineGraphSnapshot) => {
    const pending = pendingSaves.get(pipelineId);
    if (pending) {
      clearTimeout(pending.timeout);
    }

    const update = (latestSnapshot: PipelineGraphSnapshot) =>
      updatePipeline({
        id: pipelineId,
        resource: ResourceName.pipelines,
        successNotification: false,
        values: latestSnapshot,
      }).catch((error: unknown) => {
        toastStore.getState().addToast({
          description: t("canvas.floatingMenu.saveFailedDescription"),
          title: t("canvas.saveFailed"),
          type: "error",
        });

        throw error;
      });
    const timeout = setTimeout(() => {
      const latest = pendingSaves.get(pipelineId);
      if (!latest) {
        return;
      }
      pendingSaves.delete(pipelineId);
      enqueueSave(pipelineId, () => latest.update(latest.snapshot));
    }, SAVE_DELAY_MS);

    pendingSaves.set(pipelineId, { snapshot, timeout, update });
  };
};
