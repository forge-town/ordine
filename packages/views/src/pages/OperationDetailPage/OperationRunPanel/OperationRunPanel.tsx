import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Card } from "@repo/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@repo/ui/sheet";
import { useCustomMutation, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import {
  PipelineDefinitionSchema,
  OperationRevisionSchema,
  type Operation,
  type OperationRevision,
} from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { usePublishedRun } from "../../../components/ExecutionRequest/usePublishedRun";
import { PublishedRunStatus } from "../../../components/ExecutionRequest/PublishedRunStatus";
import { useOperationDetailPageStore } from "../_store";
import { operationRunPorts, parseOperationRunInputs } from "./operationRunInputs";

export const OperationRunPanel = ({ operationId }: { operationId: string }) => {
  const { t } = useTranslation();
  const { result: operation } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const { mutateAsync: publish } = useCustomMutation({ mutationOptions: { retry: false } });
  const store = useOperationDetailPageStore();
  const isOpen = useStore(store, (s) => s.isRunPanelOpen);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [publishedOperation, setPublishedOperation] = useState<OperationRevision | null>(null);
  const { state, submit, handleReset, handleReceipt } = usePublishedRun(`operation:${operationId}`);
  const sourcePorts = operation ? operationRunPorts(operation) : null;
  const ports = publishedOperation?.inputPorts ?? (sourcePorts?.isOk() ? sourcePorts.value : []);
  const portError = sourcePorts?.isErr() ? sourcePorts.error.message : null;
  const busy = Boolean(state.pendingAction);
  const locked = busy || state.submission.phase !== "idle";
  const handleSheetOpenChange = (open: boolean) => {
    if (!open) store.getState().handleCloseRunPanelButtonClick();
  };
  const handleRun = () =>
    void submit(async () => {
      if (!operation || portError) throw new Error(portError ?? "Operation 尚未加载");
      await parseOperationRunInputs(ports, drafts);
      const response = await publish({
        url: "execution/publish-operation",
        method: "post",
        values: { operationId },
      });
      const pipeline = PipelineDefinitionSchema.parse(response.data.pipeline);
      const actual = OperationRevisionSchema.parse(response.data.operation);
      setPublishedOperation(actual);
      if (JSON.stringify(ports) !== JSON.stringify(actual.inputPorts))
        throw new Error("发布后的输入端口已更新，已保留填写内容；请检查端口后再次运行。");
      const inputs = await parseOperationRunInputs(actual.inputPorts, drafts);

      return {
        pipelineId: pipeline.id,
        expectedRevision: pipeline.revision,
        inputs,
        executionOverrides: {},
        deliveryRequirements: [],
      };
    });

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("operations.run.title", "Run Operation")}</SheetTitle>
          <SheetDescription>{operation?.name ?? ""}</SheetDescription>
        </SheetHeader>
        <Card className="mx-4 p-4" variant="surface">
          <div className="space-y-3">
            {ports.length === 0 && !portError && (
              <p className="text-sm text-muted-foreground">此 Operation 无需外部输入。</p>
            )}
            {portError && (
              <p className="text-sm text-destructive" role="alert">
                {portError}
              </p>
            )}
            {ports.map((port) => {
              const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDrafts((current) => ({ ...current, [port.id]: event.target.value }));

              return (
                <label key={port.id} className="block space-y-1.5 text-xs font-medium">
                  <span>
                    {port.id} · {port.valueType} · {port.cardinality} ·{" "}
                    {port.required ? "必填" : "可选"}
                  </span>
                  <Textarea
                    aria-label={`输入 ${port.id}`}
                    className="resize-y font-mono text-sm"
                    disabled={locked}
                    placeholder={
                      port.cardinality === "many"
                        ? port.valueType === "text"
                          ? '["第一项", "第二项"]'
                          : '[{"key":"value"}]'
                        : port.valueType === "json"
                          ? '{"key":"value"}'
                          : "输入文本"
                    }
                    rows={4}
                    value={drafts[port.id] ?? ""}
                    onChange={handleChange}
                  />
                  {port.cardinality === "many" && (
                    <span className="text-muted-foreground">用 JSON 数组按顺序填写多项值。</span>
                  )}
                </label>
              );
            })}
            <Button
              className="w-full"
              disabled={locked || !operation || Boolean(portError)}
              size="sm"
              onClick={handleRun}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              {state.pendingAction ?? t("operations.run.run", "Run")}
            </Button>
          </div>
        </Card>
        <div className="mx-4 pb-4">
          <PublishedRunStatus
            busy={busy}
            error={state.error}
            submission={state.submission}
            onReceipt={handleReceipt}
            onReset={handleReset}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
