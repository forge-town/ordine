import { useNavigate } from "@tanstack/react-router";
import { useOne, useDelete } from "@refinedev/core";
import { useStore } from "zustand";
import {
  Bot,
  Trash2,
  Pencil,
  Cpu,
  Tag,
  Wrench,
  Sparkles,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Separator } from "@repo/ui/separator";
import { Skeleton } from "@repo/ui/skeleton";
import type { Agent } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageHeader } from "@/components/PageHeader";
import { Route } from "@/routes/_layout/agents.$agentId.index";
import { useAgentDetailPageStore } from "../_store";
import { PropRow } from "./PropRow";

const s = "agents";

export const AgentDetailPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agentId } = Route.useParams();
  const { result, query: agentQuery } = useOne<Agent>({
    resource: ResourceName.agents,
    id: agentId,
  });
  const { mutateAsync: deleteMutate } = useDelete();

  const store = useAgentDetailPageStore();
  const deleteConfirm = useStore(store, (s) => s.deleteConfirm);
  const copied = useStore(store, (s) => s.copied);
  const handleDeleteConfirmSet = useStore(store, (s) => s.handleDeleteConfirmSet);
  const handleDeleteBlur = useStore(store, (s) => s.handleDeleteBlur);
  const handleCopied = useStore(store, (s) => s.handleCopied);

  const agent = result ?? null;

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      handleDeleteConfirmSet(true);

      return;
    }
    if (!agent) return;
    deleteMutate({
      resource: ResourceName.agents,
      id: agent.id,
    }).then(() => {
      navigate({ to: "/agents" });
    });
  };

  const handleCopyId = () => {
    if (!agent) return;
    navigator.clipboard.writeText(agent.id);
    handleCopied();
  };

  if (agentQuery.isLoading || !agent) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          backTo="/agents"
          icon={<Bot className="h-4 w-4 text-primary" />}
          title={t(`${s}.title`)}
        />
        <div className="flex-1 p-6">
          <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-lg border p-5">
              <Skeleton className="mx-auto h-12 w-12 rounded-lg" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="rounded-lg border">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="m-4 h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t(`${s}.editTitle`)}
            </Button>
            <Button
              size="icon"
              variant={deleteConfirm ? "destructive" : "ghost"}
              onBlur={handleDeleteBlur}
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
        backTo="/agents"
        icon={<Bot className="h-4 w-4 text-primary" />}
        title={agent.name}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left: Inspector sidebar */}
          <div className="flex flex-col gap-4 rounded-lg border p-5">
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-center text-sm font-semibold">{agent.name}</h2>
              {agent.description && (
                <p className="text-center text-xs text-muted-foreground line-clamp-3">
                  {agent.description}
                </p>
              )}
            </div>

            <Separator />

            <div className="flex flex-col">
              <PropRow icon={<Cpu className="h-3.5 w-3.5" />} label={t(`${s}.defaultRuntime`)}>
                {agent.defaultRuntime ? (
                  <Badge variant="outline">{agent.defaultRuntime}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </PropRow>

              <PropRow icon={<Tag className="h-3.5 w-3.5" />} label={t(`${s}.tags`)}>
                {agent.tags.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {agent.tags.map((tag) => (
                      <Badge key={tag} className="text-[10px]" variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </PropRow>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">{agent.id}</span>
              <Button className="h-6 w-6" size="icon" variant="ghost" onClick={handleCopyId}>
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* Right: Content pane */}
          <div className="flex flex-col overflow-hidden rounded-lg border bg-background">
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* System Prompt */}
              {agent.systemPrompt && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {t(`${s}.form.systemPrompt`)}
                  </div>
                  <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </pre>
                </div>
              )}

              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t(`${s}.capabilities`)}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {agent.capabilities.map((cap) => (
                      <div
                        key={cap.name}
                        className="rounded-md border bg-card p-3 transition-colors"
                      >
                        <div className="text-sm font-medium">{cap.name}</div>
                        {cap.description && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {cap.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allowed Tools */}
              {agent.allowedTools.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Wrench className="h-3.5 w-3.5" />
                    {t(`${s}.allowedTools`)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.allowedTools.map((tool) => (
                      <Badge key={tool} className="font-mono text-xs" variant="secondary">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Allowed Skills */}
              {agent.allowedSkillIds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t(`${s}.allowedSkills`)}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.allowedSkillIds.map((skillId) => (
                      <Badge key={skillId} className="font-mono text-xs" variant="outline">
                        {skillId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!agent.systemPrompt &&
                agent.capabilities.length === 0 &&
                agent.allowedTools.length === 0 &&
                agent.allowedSkillIds.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bot className="mb-3 h-8 w-8 opacity-30" />
                    <p className="text-xs">{t(`${s}.noCapabilities`)}</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
