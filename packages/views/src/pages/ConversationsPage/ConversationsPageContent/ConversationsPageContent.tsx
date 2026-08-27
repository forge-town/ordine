import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustomMutation, useList } from "@refinedev/core";
import type { ConversationMessage, PipelineData } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { ResourceName } from "../../../constants";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageState } from "../../../components/PageState";

type ConversationGroup = {
  pipelineId: string;
  messageCount: number;
  lastMessage: ConversationMessage;
};

export const ConversationsPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { result: messagesResult, query: messagesQuery } = useList<ConversationMessage>({
    resource: ResourceName.conversationMessages,
  });
  const { result: pipelinesResult } = useList<PipelineData>({
    resource: ResourceName.pipelines,
  });
  const { mutateAsync: clearAll, mutation: clearAllMutation } = useCustomMutation();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const messages = messagesResult.data;
  const pipelines = pipelinesResult.data;
  const pipelineNameById = useMemo(
    () => new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name])),
    [pipelines],
  );

  const groups = useMemo<ConversationGroup[]>(() => {
    const byPipeline = new Map<string, ConversationMessage[]>();
    for (const message of messages) {
      const list = byPipeline.get(message.pipelineId) ?? [];
      list.push(message);
      byPipeline.set(message.pipelineId, list);
    }

    return [...byPipeline.entries()]
      .map(([pipelineId, list]) => {
        const sorted = [...list].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        return {
          pipelineId,
          messageCount: sorted.length,
          lastMessage: sorted[sorted.length - 1],
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
      );
  }, [messages]);

  const handleOpenGroup = (group: ConversationGroup) => () => {
    void navigate({ search: { id: group.pipelineId }, to: "/canvas" });
  };
  const handleClearAll = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      setTimeout(() => setConfirmingClear(false), 3000);

      return;
    }
    setConfirmingClear(false);
    await clearAll({
      errorNotification: false,
      method: "post",
      successNotification: false,
      url: "conversations/clearAll",
      values: {},
    });
    void messagesQuery?.refetch?.();
  };

  if (messagesQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          icon={<MessageSquare className="h-4 w-4 text-primary" />}
          sub={t("conversations.subtitle")}
          title={t("conversations.title")}
        />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          groups.length > 0 ? (
            <Button
              className="flex items-center gap-1.5"
              data-testid="conversations-clear-all"
              disabled={clearAllMutation.isPending}
              size="sm"
              variant={confirmingClear ? "destructive" : "outline"}
              onClick={handleClearAll}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmingClear ? t("conversations.clearAllConfirm") : t("conversations.clearAll")}
            </Button>
          ) : undefined
        }
        icon={<MessageSquare className="h-4 w-4 text-primary" />}
        sub={t("conversations.subtitle")}
        title={t("conversations.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {groups.length === 0 ? (
          <PageState
            description={t("conversations.emptyDescription")}
            icon={<MessageSquare />}
            title={t("conversations.emptyTitle")}
          />
        ) : (
          <div
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface"
            data-testid="conversations-list"
          >
            {groups.map((group) => (
              <button
                key={group.pipelineId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                data-testid={`conversation-${group.pipelineId}`}
                type="button"
                onClick={handleOpenGroup(group)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {pipelineNameById.get(group.pipelineId) ?? group.pipelineId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {group.lastMessage.content}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t("conversations.messageCount", { count: group.messageCount })}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(group.lastMessage.createdAt).toLocaleString()}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
