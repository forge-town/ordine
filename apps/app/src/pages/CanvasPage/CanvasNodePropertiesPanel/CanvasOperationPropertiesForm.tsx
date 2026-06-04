import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useList, useOne, useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import {
  FileCode,
  Folder,
  FolderGit2,
  MessageSquareText,
  Puzzle,
  Save,
  Terminal,
  Wand2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import type {
  AgentMode,
  ObjectType,
  Operation,
  OperationConfigInput,
  OperationExecutorType,
  Skill,
} from "@repo/schemas";

const EXECUTOR_ICONS = {
  agent: Wand2,
  script: Terminal,
} as const satisfies Record<string, React.ElementType>;

const AGENT_MODE_ICONS = {
  skill: Puzzle,
  prompt: Wand2,
} as const satisfies Record<string, React.ElementType>;

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  "github-project": FolderGit2,
  prompt: MessageSquareText,
};

const DEFAULT_ACCEPTED_OBJECT_TYPES: ObjectType[] = ["file", "folder", "github-project"];

type LoadedOperation = Partial<Operation> & { id?: string };

const parseExecutorDefaults = (
  config?: OperationConfigInput,
): {
  executorType: OperationExecutorType;
  agentMode: AgentMode;
  skillId: string;
  promptText: string;
  scriptCommand: string;
  scriptLanguage: "bash" | "python" | "javascript";
} => {
  const defaults = {
    executorType: "script" as OperationExecutorType,
    agentMode: "skill" as AgentMode,
    skillId: "",
    promptText: "",
    scriptCommand: "",
    scriptLanguage: "bash" as "bash" | "python" | "javascript",
  };

  const ex = config?.executor;
  if (!ex) return defaults;

  const { executorType, agentMode } = (() => {
    if (ex.type === "agent") {
      return {
        executorType: "agent" as OperationExecutorType,
        agentMode: (["skill", "prompt"].includes(ex.agentMode ?? "")
          ? ex.agentMode
          : "skill") as AgentMode,
      };
    }

    return { executorType: "script" as OperationExecutorType, agentMode: "skill" as AgentMode };
  })();

  return {
    executorType,
    agentMode,
    skillId: ex.skillId ?? "",
    promptText: ex.prompt ?? "",
    scriptCommand: ex.command ?? "",
    scriptLanguage: (["bash", "python", "javascript"].includes(ex.language ?? "")
      ? ex.language
      : "bash") as "bash" | "python" | "javascript",
  };
};

const getOperationName = (operation: LoadedOperation, fallbackId: string): string => {
  const name = operation.name?.trim();

  return name || fallbackId;
};

const getAcceptedObjectTypes = (operation: LoadedOperation): ObjectType[] =>
  Array.isArray(operation.acceptedObjectTypes)
    ? [...operation.acceptedObjectTypes]
    : DEFAULT_ACCEPTED_OBJECT_TYPES;

const buildConfig = (
  executorType: OperationExecutorType,
  agentMode: AgentMode,
  skillId: string,
  promptText: string,
  scriptCommand: string,
  scriptLanguage: "bash" | "python" | "javascript",
): OperationConfigInput => {
  if (executorType === "agent") {
    if (agentMode === "skill") {
      return {
        executor: {
          type: "agent",
          agentMode: "skill",
          skillId,
        },
      };
    }

    return {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: promptText,
      },
    };
  }

  return {
    executor: {
      type: "script",
      command: scriptCommand,
      language: scriptLanguage,
    },
  };
};

const toggleObjectType = (current: ObjectType[], type: ObjectType): ObjectType[] => {
  if (current.includes(type)) {
    if (current.length === 1) return current;

    return current.filter((t) => t !== type);
  }

  return [...current, type];
};

interface CanvasOperationPropertiesFormProps {
  operationId: string;
  onOperationUpdated?: (operation: Operation) => void;
}

export const CanvasOperationPropertiesForm = ({
  operationId,
  onOperationUpdated,
}: CanvasOperationPropertiesFormProps) => {
  const { t } = useTranslation();
  const { result: operationResult, query: operationQuery } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const { mutateAsync: updateOpMutate } = useUpdate();

  const operation = operationResult as LoadedOperation | undefined;
  const skills = skillsResult.data;
  const isLoading = operationQuery?.isLoading || skillsQuery?.isLoading;

  // Local form state derived from operation
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [acceptedObjectTypes, setAcceptedObjectTypes] = useState<ObjectType[]>(
    DEFAULT_ACCEPTED_OBJECT_TYPES,
  );
  const [executorType, setExecutorType] = useState<OperationExecutorType>("agent");
  const [agentMode, setAgentMode] = useState<AgentMode>("skill");
  const [skillId, setSkillId] = useState("");
  const [promptText, setPromptText] = useState("");
  const [scriptCommand, setScriptCommand] = useState("");
  const [scriptLanguage, setScriptLanguage] = useState<"bash" | "python" | "javascript">("bash");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when operation loads or changes
  useEffect(() => {
    if (operation) {
      setName(getOperationName(operation, operationId));
      setDescription(operation.description ?? "");
      setAcceptedObjectTypes(getAcceptedObjectTypes(operation));
      const defaults = parseExecutorDefaults(operation.config);
      setExecutorType(defaults.executorType);
      setAgentMode(defaults.agentMode);
      setSkillId(defaults.skillId);
      setPromptText(defaults.promptText);
      setScriptCommand(defaults.scriptCommand);
      setScriptLanguage(defaults.scriptLanguage);
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation?.id]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
      markChanged();
    },
    [markChanged],
  );

  const handleDescriptionChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setDescription(event.target.value);
      markChanged();
    },
    [markChanged],
  );

  const handleObjectTypeToggle = useCallback(
    (type: ObjectType) => {
      setAcceptedObjectTypes((prev) => toggleObjectType(prev, type));
      markChanged();
    },
    [markChanged],
  );

  const handleExecutorTypeChange = useCallback(
    (value: OperationExecutorType) => {
      setExecutorType(value);
      markChanged();
    },
    [markChanged],
  );

  const handleAgentModeChange = useCallback(
    (value: AgentMode) => {
      setAgentMode(value);
      markChanged();
    },
    [markChanged],
  );

  const handleSkillChange = useCallback(
    (value: string | null) => {
      if (value) {
        setSkillId(value);
        markChanged();
      }
    },
    [markChanged],
  );

  const handlePromptChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPromptText(event.target.value);
      markChanged();
    },
    [markChanged],
  );

  const handleScriptCommandChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setScriptCommand(event.target.value);
      markChanged();
    },
    [markChanged],
  );

  const handleScriptLanguageChange = useCallback(
    (value: string | null) => {
      if (value) {
        setScriptLanguage(value as "bash" | "python" | "javascript");
        markChanged();
      }
    },
    [markChanged],
  );

  const handleSave = useCallback(async () => {
    if (!operation || isSaving) return;
    setIsSaving(true);
    const config = buildConfig(
      executorType,
      agentMode,
      skillId,
      promptText,
      scriptCommand,
      scriptLanguage,
    );
    const result = await ResultAsync.fromPromise(
      updateOpMutate({
        resource: ResourceName.operations,
        id: operationId,
        values: {
          name,
          description: description || null,
          config: {
            ...operation.config,
            ...config,
          },
          acceptedObjectTypes,
        },
      }),
      (e) => (e instanceof Error ? e.message : String(e)),
    );
    setIsSaving(false);
    if (result.isErr()) {
      toastStore.getState().addToast({
        type: "error",
        title: t("canvas.saveFailed"),
        description: result.error,
      });

      return;
    }
    setHasChanges(false);
    if (result.value.data) {
      const updated = result.value.data as Operation;
      setName(getOperationName(updated, operationId));
      setDescription(updated.description ?? "");
      setAcceptedObjectTypes(getAcceptedObjectTypes(updated));
      const defaults = parseExecutorDefaults(updated.config);
      setExecutorType(defaults.executorType);
      setAgentMode(defaults.agentMode);
      setSkillId(defaults.skillId);
      setPromptText(defaults.promptText);
      setScriptCommand(defaults.scriptCommand);
      setScriptLanguage(defaults.scriptLanguage);
      if (onOperationUpdated) {
        onOperationUpdated(updated);
      }
    }
  }, [
    operation,
    operationId,
    name,
    description,
    executorType,
    agentMode,
    skillId,
    promptText,
    scriptCommand,
    scriptLanguage,
    acceptedObjectTypes,
    updateOpMutate,
    onOperationUpdated,
    isSaving,
    t,
  ]);

  const OBJECT_TYPE_OPTIONS: { value: ObjectType; label: string; icon: React.ElementType }[] = [
    { value: "file", label: t("operations.objectTypeFile"), icon: OBJECT_TYPE_ICONS.file },
    { value: "folder", label: t("operations.objectTypeFolder"), icon: OBJECT_TYPE_ICONS.folder },
    {
      value: "github-project",
      label: t("operations.objectTypeProject"),
      icon: OBJECT_TYPE_ICONS["github-project"],
    },
    { value: "prompt", label: t("operations.objectTypePrompt"), icon: OBJECT_TYPE_ICONS.prompt },
  ];

  const EXECUTOR_TYPE_OPTIONS = [
    {
      value: "agent" as const,
      label: "Agent",
      icon: EXECUTOR_ICONS.agent,
      description: t("operations.executorAgentDesc"),
    },
    {
      value: "script" as const,
      label: "Script",
      icon: EXECUTOR_ICONS.script,
      description: t("operations.executorScriptDesc"),
    },
  ];

  const AGENT_MODE_OPTIONS = [
    {
      value: "skill" as const,
      label: "Skill",
      icon: AGENT_MODE_ICONS.skill,
      description: t("operations.agentModeSkillDesc"),
    },
    {
      value: "prompt" as const,
      label: "Prompt",
      icon: AGENT_MODE_ICONS.prompt,
      description: t("operations.agentModePromptDesc"),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
        <div className="h-8 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!operation) {
    return <p className="text-xs text-muted-foreground">{t("operations.operationNotFound")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("operations.nameLabel")}
        </Label>
        <Input className="h-8 text-sm" value={name} onChange={handleNameChange} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("operations.descriptionLabel")}
        </Label>
        <Input
          className="h-8 text-sm"
          placeholder={t("operations.descriptionPlaceholder")}
          value={description}
          onChange={handleDescriptionChange}
        />
      </div>

      {/* Accepted Object Types */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          {t("operations.acceptedObjectTypes")}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {OBJECT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = acceptedObjectTypes.includes(value);

            return (
              <Button
                key={value}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-normal transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60",
                )}
                type="button"
                variant="ghost"
                onClick={() => handleObjectTypeToggle(value)}
              >
                <Icon className="h-3 w-3" />
                {label}
                {selected && <span className="ml-0.5 text-[10px]">✓</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Executor section */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <Label className="text-xs font-semibold text-foreground">
          {t("operations.executorType")}
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {EXECUTOR_TYPE_OPTIONS.map(({ value, label, icon: Icon, description }) => {
            const selected = executorType === value;

            return (
              <Button
                key={value}
                className={cn(
                  "flex h-auto flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs font-normal transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/60",
                )}
                type="button"
                variant="ghost"
                onClick={() => handleExecutorTypeChange(value)}
              >
                <span className="flex items-center gap-1 font-medium">
                  <Icon className="h-3 w-3" />
                  {label}
                </span>
                <span className="text-[10px] opacity-70">{description}</span>
              </Button>
            );
          })}
        </div>

        {/* Agent Mode */}
        {executorType === "agent" && (
          <>
            <Label className="text-xs font-medium text-muted-foreground">
              {t("operations.agentMode")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_MODE_OPTIONS.map(({ value, label, icon: Icon, description }) => {
                const selected = agentMode === value;

                return (
                  <Button
                    key={value}
                    className={cn(
                      "flex h-auto flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-xs font-normal transition-colors",
                      selected
                        ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/60",
                    )}
                    type="button"
                    variant="ghost"
                    onClick={() => handleAgentModeChange(value)}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <Icon className="h-3 w-3" />
                      {label}
                    </span>
                    <span className="text-[10px] opacity-70">{description}</span>
                  </Button>
                );
              })}
            </div>

            {/* Skill Select */}
            {agentMode === "skill" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("operations.skillLabel")}
                </Label>
                <Select value={skillId} onValueChange={handleSkillChange}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder={t("operations.selectSkill")} />
                  </SelectTrigger>
                  <SelectContent>
                    {skills.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Prompt */}
            {agentMode === "prompt" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("operations.promptLabel")}
                </Label>
                <Textarea
                  className="min-h-20 resize-y bg-background text-xs"
                  placeholder={t("operations.promptPlaceholder")}
                  rows={4}
                  value={promptText}
                  onChange={handlePromptChange}
                />
              </div>
            )}
          </>
        )}

        {/* Script */}
        {executorType === "script" && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("operations.scriptCommand")}
              </Label>
              <Input
                className="h-8 bg-background font-mono text-xs"
                placeholder="e.g. eslint src/ --fix"
                value={scriptCommand}
                onChange={handleScriptCommandChange}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("operations.scriptLanguage")}
                </Label>
                <Select value={scriptLanguage} onValueChange={handleScriptLanguageChange}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bash">Bash</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      {hasChanges && (
        <Button
          className="w-full transition-all duration-200"
          disabled={isSaving || !name.trim()}
          size="sm"
          type="button"
          onClick={handleSave}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </div>
  );
};
