import { useRef, type ChangeEvent } from "react";
import { useCreate, useUpdate } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { ResultAsync } from "neverthrow";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { useCanvasPageStore } from "./_store";
import {
  isCanvasImportFileTooLarge,
  parseCanvasImportJson,
  type CanvasImportError,
} from "./utils/canvasImportJson";

interface UseCanvasWorkspacePersistenceOptions {
  onAfterImportFileSelect?: () => void;
  onAfterSave?: () => void;
}

export const useCanvasWorkspacePersistence = ({
  onAfterImportFileSelect,
  onAfterSave,
}: UseCanvasWorkspacePersistenceOptions = {}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useCanvasPageStore();
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const importCanvas = useStore(store, (state) => state.importCanvas);
  const handlePipelineIdChange = useStore(store, (state) => state.handlePipelineIdChange);
  const { mutate: updateCanvas, mutation: updateMutation } = useUpdate();
  const { mutate: createCanvas, mutation: createMutation } = useCreate();

  const displayPipelineName = pipelineName || t("canvas.pipelineTitlePlaceholder");
  const isPending = updateMutation.isPending || createMutation.isPending;

  const showImportError = (error: CanvasImportError) => {
    const description =
      error === "invalid-json"
        ? t("canvas.importInvalidJson")
        : error === "file-too-large"
          ? t("canvas.importFileTooLarge")
          : t("canvas.importInvalidPipelineJson");

    toastStore.getState().addToast({
      type: "error",
      title: t("canvas.importFailed"),
      description,
    });
  };

  const handleSave = () => {
    if (pipelineId) {
      updateCanvas({
        resource: ResourceName.pipelines,
        id: pipelineId,
        values: { nodes, edges },
        successNotification: {
          type: "success",
          message: t("canvas.saveSuccess"),
          description: t("canvas.floatingMenu.saveSuccessDescription", {
            name: displayPipelineName,
          }),
        },
        errorNotification: {
          type: "error",
          message: t("canvas.saveFailed"),
          description: t("canvas.floatingMenu.saveFailedDescription"),
        },
      });
      onAfterSave?.();

      return;
    }

    const newId = crypto.randomUUID();
    createCanvas(
      {
        resource: ResourceName.pipelines,
        values: {
          id: newId,
          name: displayPipelineName,
          description: "",
          tags: [],
          timeoutMs: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          nodes,
          edges,
        },
        successNotification: {
          type: "success",
          message: t("canvas.saveSuccess"),
          description: t("canvas.floatingMenu.createSuccessDescription", {
            name: displayPipelineName,
          }),
        },
        errorNotification: {
          type: "error",
          message: t("canvas.saveFailed"),
          description: t("canvas.floatingMenu.saveFailedDescription"),
        },
      },
      {
        onSuccess: () => {
          handlePipelineIdChange(newId);
        },
      },
    );
    onAfterSave?.();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";
    onAfterImportFileSelect?.();

    if (isCanvasImportFileTooLarge(file)) {
      showImportError("file-too-large");

      return;
    }

    void ResultAsync.fromPromise(file.text(), () => "invalid-json" as const)
      .andThen((text) => parseCanvasImportJson(text))
      .match(importCanvas, showImportError);
  };

  return {
    fileInputRef,
    handleImport,
    handleImportFileChange,
    handleSave,
    isPending,
  };
};
