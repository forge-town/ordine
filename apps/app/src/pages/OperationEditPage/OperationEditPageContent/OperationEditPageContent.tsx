import { useNavigate } from "@tanstack/react-router";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Bot,
  CheckCircle2,
  Code2,
  FileCode,
  FileOutput,
  Folder,
  FolderGit2,
  Info,
  ListChecks,
  MessageSquareText,
  Plus,
  Puzzle,
  Save,
  Settings2,
  Terminal,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Separator } from "@repo/ui/separator";
import { Textarea } from "@repo/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import { useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import {
  type Operation,
  type Skill,
  ObjectTypeSchema,
  type ObjectType,
  ExecutorTypeSchema,
  AgentModeSchema,
  ScriptLanguageSchema,
  OutputItemSchema,
  TemplateContentTypeSchema,
  type TemplateContentType,
  type ExecutorType,
  type AgentMode,
  type OperationConfigInput,
} from "@repo/schemas";
import { useStore } from "zustand";
import { useOperationEditPageStore } from "../_store";
import { PageHeader } from "@/components/PageHeader";

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
  project: FolderGit2,
  prompt: MessageSquareText,
};

const editableOutputItemSchema = OutputItemSchema.extend({
  templateIds: z.array(z.string()),
});

const OUTPUT_CONTENT_TYPE_OPTIONS: {
  value: TemplateContentType;
  label: string;
}[] = TemplateContentTypeSchema.options.map((value) => ({
  value,
  label: value.toUpperCase(),
}));

const editFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  acceptedObjectTypes: z.array(ObjectTypeSchema).min(1),
  executorType: ExecutorTypeSchema,
  agentMode: AgentModeSchema,
  skillId: z.string(),
  promptText: z.string(),
  scriptCommand: z.string(),
  scriptLanguage: ScriptLanguageSchema,
  outputs: z.array(editableOutputItemSchema),
});

type EditFormValues = z.infer<typeof editFormSchema>;

const buildConfig = (values: EditFormValues): OperationConfigInput => {
  if (values.executorType === "agent") {
    if (values.agentMode === "skill") {
      return {
        executor: {
          type: "agent",
          agentMode: "skill",
          skillId: values.skillId,
        },
      };
    }

    return {
      executor: {
        type: "agent",
        agentMode: "prompt",
        prompt: values.promptText,
      },
    };
  }

  return {
    executor: {
      type: "script",
      command: values.scriptCommand,
      language: values.scriptLanguage,
    },
  };
};

const parseExecutorDefaults = (
  config: OperationConfigInput,
): {
  executorType: ExecutorType;
  agentMode: AgentMode;
  skillId: string;
  promptText: string;
  scriptCommand: string;
  scriptLanguage: "bash" | "python" | "javascript";
} => {
  const defaults = {
    executorType: "script" as ExecutorType,
    agentMode: "skill" as AgentMode,
    skillId: "",
    promptText: "",
    scriptCommand: "",
    scriptLanguage: "bash" as "bash" | "python" | "javascript",
  };

  const ex = config.executor;
  if (!ex) return defaults;

  const { executorType, agentMode } = (() => {
    if (ex.type === "agent") {
      return {
        executorType: "agent" as ExecutorType,
        agentMode: (["skill", "prompt"].includes(ex.agentMode ?? "")
          ? ex.agentMode
          : "skill") as AgentMode,
      };
    }

    return { executorType: "script" as ExecutorType, agentMode: "skill" as AgentMode };
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

const toggleObjectType = (current: ObjectType[], type: ObjectType): ObjectType[] => {
  if (current.includes(type)) {
    if (current.length === 1) return current;

    return current.filter((t) => t !== type);
  }

  return [...current, type];
};

interface Props {
  operation: Operation;
  skills: Skill[];
}

export const OperationEditPageContent = ({ operation, skills }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateOpMutate } = useUpdate();

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

  const OBJECT_TYPE_OPTIONS: {
    value: ObjectType;
    label: string;
    icon: React.ElementType;
  }[] = [
    {
      value: "file",
      label: t("operations.objectTypeFile"),
      icon: OBJECT_TYPE_ICONS.file,
    },
    {
      value: "folder",
      label: t("operations.objectTypeFolder"),
      icon: OBJECT_TYPE_ICONS.folder,
    },
    {
      value: "project",
      label: t("operations.objectTypeProject"),
      icon: OBJECT_TYPE_ICONS.project,
    },
    {
      value: "prompt",
      label: t("operations.objectTypePrompt"),
      icon: OBJECT_TYPE_ICONS.prompt,
    },
  ];

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: operation.name,
      description: operation.description ?? "",
      acceptedObjectTypes: Array.isArray(operation.acceptedObjectTypes)
        ? [...operation.acceptedObjectTypes]
        : ["file", "folder", "project"],
      outputs: (operation.config.outputs ?? []).map((output) => ({
        name: output.name,
        contentType: output.contentType,
        description: output.description ?? "",
        templateIds: [...output.templateIds],
      })),
      ...parseExecutorDefaults(operation.config),
    },
  });

  const {
    fields: outputFields,
    append: appendOutput,
    remove: removeOutput,
  } = useFieldArray({
    control: form.control,
    name: "outputs",
  });

  const executorType = form.watch("executorType");
  const agentMode = form.watch("agentMode");
  const acceptedObjectTypes = form.watch("acceptedObjectTypes");
  const selectedSkillId = form.watch("skillId");
  const scriptLanguage = form.watch("scriptLanguage");
  const editableOutputs = form.watch("outputs");
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
  const inputs = operation.config.inputs ?? [];

  const store = useOperationEditPageStore();
  const skillOpen = useStore(store, (s) => s.skillOpen);
  const handleSkillOpenChange = useStore(store, (s) => s.handleSetSkillOpen);
  const handleSkillToggle = useStore(store, (s) => s.handleToggleSkillOpen);

  const scriptLangOpen = useStore(store, (s) => s.scriptLangOpen);
  const handleScriptLangOpenChange = useStore(store, (s) => s.handleSetScriptLangOpen);
  const handleScriptLangToggle = useStore(store, (s) => s.handleToggleScriptLangOpen);

  const getObjectTypeLabel = (type: ObjectType) =>
    OBJECT_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

  const handleCancel = () => {
    void navigate({
      to: "/pipelines/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  const handleAppendOutput = () => {
    appendOutput({
      name: "",
      contentType: "markdown",
      description: "",
      templateIds: [],
    });
  };

  const handleRemoveOutput = (index: number) => {
    removeOutput(index);
  };

  const onSubmit = async (values: EditFormValues) => {
    await updateOpMutate({
      resource: ResourceName.operations,
      id: operation.id,
      values: {
        name: values.name,
        description: values.description || null,
        config: {
          ...operation.config,
          ...buildConfig(values),
          outputs: values.outputs.map((output) => ({
            ...output,
            description: output.description || undefined,
            templateIds: output.templateIds ?? [],
          })),
        },
        acceptedObjectTypes: values.acceptedObjectTypes,
      },
    });
    void navigate({
      to: "/pipelines/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        backTo={`/pipelines/operations/${operation.id}`}
        title={t("operations.editOperation")}
      />

      <Form {...form}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{t("operations.identityAndScope")}</h2>
                      <p className="text-xs text-muted-foreground">
                        {t("operations.identityAndScopeDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 p-5">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {t("operations.nameLabel")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-10 text-sm"
                                placeholder="e.g. Run ESLint"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {t("operations.descriptionLabel")}
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-10 resize-none text-sm"
                                placeholder={t("operations.descriptionPlaceholder")}
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Controller
                      control={form.control}
                      name="acceptedObjectTypes"
                      render={({ field }) => {
                        const handleChange = field.onChange;

                        return (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {t("operations.acceptedObjectTypes")}
                            </FormLabel>
                            <FormControl>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                {OBJECT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                                  const selected = field.value.includes(value);

                                  return (
                                    <button
                                      key={value}
                                      className={cn(
                                        "flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                                        selected
                                          ? "border-primary/50 bg-primary/10 text-primary"
                                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                                      )}
                                      type="button"
                                      onClick={() =>
                                        handleChange(toggleObjectType(field.value, value))
                                      }
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="truncate font-medium">{label}</span>
                                      </span>
                                      {selected && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{t("operations.executionContract")}</h2>
                      <p className="text-xs text-muted-foreground">
                        {t("operations.executionContractDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 p-5">
                    <Controller
                      control={form.control}
                      name="executorType"
                      render={({ field }) => {
                        const handleChange = field.onChange;

                        return (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {t("operations.executorType")}
                            </FormLabel>
                            <FormControl>
                              <div className="grid gap-2 md:grid-cols-2">
                                {EXECUTOR_TYPE_OPTIONS.map(
                                  ({ value, label, icon: Icon, description }) => {
                                    const selected = field.value === value;

                                    return (
                                      <button
                                        key={value}
                                        className={cn(
                                          "flex min-h-20 items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                                          selected
                                            ? "border-primary/50 bg-primary/10 text-primary"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                                        )}
                                        type="button"
                                        onClick={() => handleChange(value)}
                                      >
                                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span className="space-y-1">
                                          <span className="block font-medium">{label}</span>
                                          <span className="block text-xs leading-5 opacity-75">
                                            {description}
                                          </span>
                                        </span>
                                      </button>
                                    );
                                  },
                                )}
                              </div>
                            </FormControl>
                          </FormItem>
                        );
                      }}
                    />

                    {executorType === "agent" && (
                      <>
                        <Controller
                          control={form.control}
                          name="agentMode"
                          render={({ field }) => {
                            const handleChange = field.onChange;

                            return (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground">
                                  {t("operations.agentMode")}
                                </FormLabel>
                                <FormControl>
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {AGENT_MODE_OPTIONS.map(
                                      ({ value, label, icon: Icon, description }) => {
                                        const selected = field.value === value;

                                        return (
                                          <button
                                            key={value}
                                            className={cn(
                                              "flex min-h-16 items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                                              selected
                                                ? "border-primary/50 bg-primary/10 text-primary"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                                            )}
                                            type="button"
                                            onClick={() => handleChange(value)}
                                          >
                                            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                                            <span className="space-y-1">
                                              <span className="block font-medium">{label}</span>
                                              <span className="block text-xs leading-5 opacity-75">
                                                {description}
                                              </span>
                                            </span>
                                          </button>
                                        );
                                      },
                                    )}
                                  </div>
                                </FormControl>
                              </FormItem>
                            );
                          }}
                        />

                        {agentMode === "skill" && (
                          <FormField
                            control={form.control}
                            name="skillId"
                            render={({ field }) => {
                              const handleChange = (v: string | null) => {
                                if (v) field.onChange(v);
                                handleSkillOpenChange(false);
                              };

                              return (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-muted-foreground">
                                    {t("operations.skillLabel")}
                                  </FormLabel>
                                  <FormControl>
                                    <Select
                                      open={skillOpen}
                                      value={field.value}
                                      onOpenChange={handleSkillOpenChange}
                                      onValueChange={handleChange}
                                    >
                                      <SelectTrigger
                                        className="h-10 w-full"
                                        onClick={handleSkillToggle}
                                      >
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
                                  </FormControl>
                                  {selectedSkill?.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {selectedSkill.description}
                                    </p>
                                  )}
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              );
                            }}
                          />
                        )}

                        {agentMode === "prompt" && (
                          <FormField
                            control={form.control}
                            name="promptText"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground">
                                  {t("operations.promptLabel")}
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    className="min-h-64 resize-y font-mono text-sm leading-6"
                                    placeholder={t("operations.promptPlaceholder")}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            )}
                          />
                        )}
                      </>
                    )}

                    {executorType === "script" && (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                        <FormField
                          control={form.control}
                          name="scriptCommand"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium text-muted-foreground">
                                {t("operations.scriptCommand")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="h-10 font-mono text-sm"
                                  placeholder="e.g. eslint src/ --fix"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="scriptLanguage"
                          render={({ field }) => {
                            const handleChange = (v: string | null) => {
                              if (v) field.onChange(v);
                              handleScriptLangOpenChange(false);
                            };

                            return (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-muted-foreground">
                                  {t("operations.scriptLanguage")}
                                </FormLabel>
                                <FormControl>
                                  <Select
                                    open={scriptLangOpen}
                                    value={field.value}
                                    onOpenChange={handleScriptLangOpenChange}
                                    onValueChange={handleChange}
                                  >
                                    <SelectTrigger
                                      className="h-10 w-full"
                                      onClick={handleScriptLangToggle}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="bash">Bash</SelectItem>
                                      <SelectItem value="python">Python</SelectItem>
                                      <SelectItem value="javascript">JavaScript</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <FileOutput className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{t("operations.dataContract")}</h2>
                      <p className="text-xs text-muted-foreground">
                        {t("operations.dataContractDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                          {t("operations.inputPorts")}
                        </h3>
                        <Badge variant="outline">{inputs.length}</Badge>
                      </div>
                      {inputs.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                          {t("operations.noConfiguredInputs")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {inputs.map((input, index) => (
                            <div
                              key={`${input.name}-${input.kind}-${index}`}
                              className="rounded-md border border-border px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-medium">{input.name}</span>
                                <Badge variant={input.required ? "default" : "secondary"}>
                                  {input.kind}
                                </Badge>
                              </div>
                              {input.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {input.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                          {t("operations.outputItems")}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{editableOutputs.length}</Badge>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={handleAppendOutput}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("operations.addOutputItem")}
                          </Button>
                        </div>
                      </div>
                      {outputFields.length === 0 ? (
                        <div className="space-y-3 rounded-md border border-dashed border-border px-3 py-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            {t("operations.noConfiguredOutputs")}
                          </p>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={handleAppendOutput}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("operations.addOutputItem")}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {outputFields.map((output, index) => (
                            <div key={output.id} className="rounded-md border border-border p-3">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {editableOutputs[index]?.name ||
                                      t("operations.unnamedOutputItem")}
                                  </p>
                                  {(editableOutputs[index]?.templateIds.length ?? 0) > 0 && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {t("operations.templates")}:{" "}
                                      {editableOutputs[index]?.templateIds.length ?? 0}
                                    </p>
                                  )}
                                  <Badge className="mt-1" variant="secondary">
                                    {editableOutputs[index]!.contentType.toUpperCase()}
                                  </Badge>
                                </div>
                                <Button
                                  aria-label={t("operations.removeOutputItem")}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleRemoveOutput(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                                <FormField
                                  control={form.control}
                                  name={`outputs.${index}.name`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium text-muted-foreground">
                                        {t("operations.outputName")}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          className="h-9 text-sm"
                                          placeholder={t("operations.outputNamePlaceholder")}
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`outputs.${index}.contentType`}
                                  render={({ field }) => {
                                    const handleContentTypeChange = field.onChange;

                                    return (
                                      <FormItem>
                                        <FormLabel className="text-xs font-medium text-muted-foreground">
                                          {t("operations.outputContentType")}
                                        </FormLabel>
                                        <FormControl>
                                          <Select
                                            value={field.value}
                                            onValueChange={handleContentTypeChange}
                                          >
                                            <SelectTrigger className="h-9 w-full">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {OUTPUT_CONTENT_TYPE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                  {option.label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                      </FormItem>
                                    );
                                  }}
                                />
                              </div>

                              <FormField
                                control={form.control}
                                name={`outputs.${index}.description`}
                                render={({ field }) => (
                                  <FormItem className="mt-3">
                                    <FormLabel className="text-xs font-medium text-muted-foreground">
                                      {t("operations.outputDescription")}
                                    </FormLabel>
                                    <FormControl>
                                      <Textarea
                                        className="min-h-20 resize-none text-sm"
                                        placeholder={t("operations.outputDescriptionPlaceholder")}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage className="text-xs" />
                                  </FormItem>
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                <section className="rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">{t("operations.operationSummary")}</h2>
                  </div>
                  <div className="space-y-4 p-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("operations.operationId")}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-foreground">
                        {operation.id}
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("operations.currentExecutor")}
                      </p>
                      <Badge variant="outline">
                        {executorType === "agent" ? (
                          <Bot className="h-3 w-3" />
                        ) : (
                          <Code2 className="h-3 w-3" />
                        )}
                        {executorType === "agent"
                          ? `Agent / ${agentMode}`
                          : `Script / ${scriptLanguage}`}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("operations.selectedObjects")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {acceptedObjectTypes.map((type) => (
                          <Badge key={type} variant="secondary">
                            {getObjectTypeLabel(type)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          {t("operations.configuredInputs")}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{inputs.length}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          {t("operations.configuredOutputs")}
                        </p>
                        <p className="mt-1 text-lg font-semibold">{editableOutputs.length}</p>
                      </div>
                    </div>

                    <p className="rounded-md bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                      {t("operations.preservedOnSave")}
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </div>

          <div className="border-t border-border bg-background/95 px-6 py-3">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {form.formState.isDirty
                  ? t("operations.unsavedChanges")
                  : t("operations.noUnsavedChanges")}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                  {t("common.cancel")}
                </Button>
                <Button disabled={form.formState.isSubmitting} size="sm" type="submit">
                  <Save className="h-4 w-4" />
                  {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
