import type { ChangeEventHandler, KeyboardEventHandler, MouseEvent, RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowUp,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  Upload,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import type { AgentExecutionChoice, AgentRuntimeCatalogEntry } from "@repo/schemas";
import { AgentExecutionPicker } from "@repo/views/AgentExecutionPicker";

export type PipelineCreationPhase =
  | "conversation"
  | "planning"
  | "proposal_ready"
  | "generating"
  | "success";

export interface PipelineCreationRuntimeOption {
  id: string;
  name: string;
}

interface PipelineCreationComposerProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  hasConversation: boolean;
  inputValue: string;
  isCancelling: boolean;
  isHome: boolean;
  isProposalReadyForApproval: boolean;
  isUploading: boolean;
  phase: PipelineCreationPhase;
  proposalVisible: boolean;
  runtimeConfigured?: boolean;
  runtimeId?: string;
  runtimeLabel?: string;
  runtimeOptions?: PipelineCreationRuntimeOption[];
  executionCatalog?: AgentRuntimeCatalogEntry[];
  executionChoice?: AgentExecutionChoice | null;
  executionLoading?: boolean;
  onRuntimeChange?: (runtimeId: string | null) => void;
  onExecutionChoiceChange?: (choice: AgentExecutionChoice) => void;
  onExecutionRuntimeChange?: (runtimeConfigId: string) => void;
  onOpenRuntimeSettings?: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onClose?: () => void;
  onInputChange: ChangeEventHandler<HTMLTextAreaElement>;
  onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onReject: () => void;
  onRevise: () => void;
  onSend: () => void;
  onSuggestion: (prompt: string) => void;
  onUploadChange: ChangeEventHandler<HTMLInputElement>;
  onUploadClick: () => void;
}

export const PipelineCreationComposer = ({
  fileInputRef,
  hasConversation,
  inputValue,
  isCancelling,
  isHome,
  isProposalReadyForApproval,
  isUploading,
  phase,
  proposalVisible,
  runtimeConfigured,
  runtimeId,
  runtimeLabel,
  runtimeOptions,
  executionCatalog,
  executionChoice,
  executionLoading,
  onRuntimeChange: handleRuntimeChange,
  onExecutionChoiceChange: handleExecutionChoiceChange,
  onExecutionRuntimeChange: handleExecutionRuntimeChange,
  onOpenRuntimeSettings: handleOpenRuntimeSettings,
  onApprove: handleApprove,
  onCancel: handleCancel,
  onClose: handleClose,
  onInputChange: handleInputChange,
  onInputKeyDown: handleInputKeyDown,
  onReject: handleReject,
  onRevise: handleRevise,
  onSend: handleSend,
  onSuggestion: handleSuggestion,
  onUploadChange: handleUploadChange,
  onUploadClick: handleUploadClick,
}: PipelineCreationComposerProps) => {
  const { t } = useTranslation();
  const runtimeMissing = isHome && runtimeConfigured !== true;
  const suggestions = [
    {
      icon: Workflow,
      label: t("home.suggestions.build"),
      description: t("home.suggestions.buildDescription"),
      prompt: t("home.suggestions.buildPrompt"),
    },
    {
      icon: Sparkles,
      label: t("home.suggestions.organize"),
      description: t("home.suggestions.organizeDescription"),
      prompt: t("home.suggestions.organizePrompt"),
    },
    {
      icon: WandSparkles,
      label: t("home.suggestions.distill"),
      description: t("home.suggestions.distillDescription"),
      prompt: t("home.suggestions.distillPrompt"),
    },
  ];
  const handleSuggestionClick = (event: MouseEvent<HTMLButtonElement>) => {
    const prompt = event.currentTarget.dataset.prompt;
    if (prompt) {
      handleSuggestion(prompt);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        aria-label={t("newPipelineDialog.upload")}
        className="hidden"
        type="file"
        onChange={handleUploadChange}
      />

      <div
        className={cn(
          "border border-border bg-card shadow-sm transition-colors focus-within:border-foreground/25",
          isHome
            ? "rounded-[14px] p-3 shadow-soft focus-within:border-cobalt/45"
            : "rounded-xl p-2.5",
        )}
      >
        <Textarea
          aria-label={t("newPipelineDialog.messagePlaceholder")}
          className={cn(
            "resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0",
            isHome ? "min-h-24 text-[15px] leading-6" : "min-h-20 text-sm",
          )}
          id="pipeline-agent-message"
          name="pipelineAgentMessage"
          placeholder={t("newPipelineDialog.messagePlaceholder")}
          rows={isHome ? 4 : 3}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            aria-label={t("newPipelineDialog.upload")}
            className={cn("shrink-0", !isHome && "px-2.5")}
            disabled={isUploading || phase === "planning" || phase === "generating"}
            size={isHome ? "icon" : "sm"}
            type="button"
            variant="ghost"
            onClick={handleUploadClick}
          >
            {isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isHome ? (
              <Paperclip className="size-4" />
            ) : (
              <Upload className="size-4" />
            )}
            {!isHome && <span>{t("newPipelineDialog.upload")}</span>}
          </Button>

          {isHome &&
          executionCatalog &&
          handleExecutionChoiceChange &&
          handleExecutionRuntimeChange ? (
            <AgentExecutionPicker
              catalog={executionCatalog}
              choice={executionChoice ?? null}
              isLoading={executionLoading}
              onChange={handleExecutionChoiceChange}
              onOpenSettings={handleOpenRuntimeSettings}
              onRuntimeChange={handleExecutionRuntimeChange}
            />
          ) : isHome && runtimeConfigured === true && runtimeId && runtimeOptions?.length ? (
            <Select value={runtimeId} onValueChange={handleRuntimeChange}>
              <SelectTrigger
                aria-label={t("home.selectLocalAgent")}
                className="h-8 min-w-0 max-w-40 border-0 px-2 text-xs text-muted-foreground shadow-none hover:bg-surface-2 hover:text-foreground"
                size="sm"
              >
                <SelectValue className="truncate">
                  {runtimeOptions.find((option) => option.id === runtimeId)?.name ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {runtimeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : isHome ? (
            <Link
              className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              to="/local-agents"
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  runtimeConfigured ? "bg-info" : "bg-muted-foreground/45",
                )}
              />
              <span className="truncate">{runtimeLabel ?? t("home.connectLocalAgent")}</span>
            </Link>
          ) : null}

          {phase === "planning" ? (
            <Button
              aria-label={t("newPipelineDialog.cancel")}
              className={cn("ml-auto shrink-0", isHome && "rounded-[10px]")}
              disabled={isCancelling}
              size={isHome ? "icon" : "sm"}
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              {isCancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-3.5 fill-current" />
              )}
              {!isHome && t("newPipelineDialog.cancel")}
            </Button>
          ) : proposalVisible ? null : (
            <Button
              aria-label={t("newPipelineDialog.send")}
              className={cn(
                "ml-auto shrink-0",
                isHome &&
                  "rounded-[7px] bg-cobalt text-white hover:bg-cobalt-bright disabled:bg-cobalt-soft disabled:text-white dark:disabled:bg-ice-wash dark:disabled:text-[#1c1d1f]",
              )}
              disabled={inputValue.trim().length === 0 || runtimeMissing}
              size={isHome ? "icon" : "sm"}
              onClick={handleSend}
            >
              {isHome ? <ArrowUp className="size-4" /> : t("newPipelineDialog.send")}
            </Button>
          )}
        </div>
      </div>

      {proposalVisible ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={phase === "generating"}
            size="sm"
            variant="ghost"
            onClick={handleReject}
          >
            {t("newPipelineDialog.reject")}
          </Button>
          <Button
            disabled={phase === "generating"}
            size="sm"
            variant="outline"
            onClick={handleRevise}
          >
            {t("newPipelineDialog.revise")}
          </Button>
          {phase === "generating" ? (
            <Button disabled={isCancelling} size="sm" variant="outline" onClick={handleCancel}>
              {isCancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Square className="size-3.5 fill-current" />
              )}
              {t("newPipelineDialog.cancel")}
            </Button>
          ) : (
            <Button disabled={!isProposalReadyForApproval} size="sm" onClick={handleApprove}>
              {t("newPipelineDialog.approve")}
            </Button>
          )}
        </div>
      ) : isHome && !hasConversation ? (
        <div className="mt-2 divide-y divide-border">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;

            return (
              <button
                key={suggestion.label}
                className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-3 text-left text-sm transition-colors hover:bg-surface-2"
                data-prompt={suggestion.prompt}
                type="button"
                onClick={handleSuggestionClick}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-medium tracking-[-0.01em]">{suggestion.label}</span>
                <span className="hidden truncate text-muted-foreground/80 sm:inline">
                  {suggestion.description}
                </span>
                <ArrowUp className="ml-auto size-3.5 rotate-45 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      ) : null}

      {!isHome && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
        </div>
      )}
    </>
  );
};
