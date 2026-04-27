import { useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { FileCode, Folder, FolderGit2, Puzzle, Terminal, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
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
};

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
});

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
  config: OperationConfigInput
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

type EditFormValues = z.infer<typeof editFormSchema>;

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
  ];

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: operation.name,
      description: operation.description ?? "",
      acceptedObjectTypes: Array.isArray(operation.acceptedObjectTypes)
        ? [...operation.acceptedObjectTypes]
        : ["file", "folder", "project"],
      ...parseExecutorDefaults(operation.config),
    },
  });

  const executorType = form.watch("executorType");
  const agentMode = form.watch("agentMode");

  const store = useOperationEditPageStore();
  const skillOpen = useStore(store, (s) => s.skillOpen);
  const handleSkillOpenChange = useStore(store, (s) => s.handleSetSkillOpen);
  const handleSkillToggle = useStore(store, (s) => s.handleToggleSkillOpen);

  const scriptLangOpen = useStore(store, (s) => s.scriptLangOpen);
  const handleScriptLangOpenChange = useStore(store, (s) => s.handleSetScriptLangOpen);
  const handleScriptLangToggle = useStore(store, (s) => s.handleToggleScriptLangOpen);

  const handleCancel = () => {
    void navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  const onSubmit = async (values: EditFormValues) => {
    await updateOpMutate({
      resource: ResourceName.operations,
      id: operation.id,
      values: {
        name: values.name,
        description: values.description || null,
        config: buildConfig(values),
        acceptedObjectTypes: values.acceptedObjectTypes,
      },
    });
    void navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader backTo={`/operations/${operation.id}`} title={t("operations.editOperation")} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("operations.nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input className="h-9 text-sm" placeholder="e.g. Run ESLint" {...field} />
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
                      <Input
                        className="h-9 text-sm"
                        placeholder={t("operations.descriptionPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

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
                        <div className="flex gap-2">
                          {OBJECT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                            const selected = field.value.includes(value);

                            return (
                              <button
                                key={value}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                  selected
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                )}
                                type="button"
                                onClick={() => handleChange(toggleObjectType(field.value, value))}
                              >
                                <Icon className="h-4 w-4" />
                                {label}
                                {selected && <span className="ml-1 text-xs">✓</span>}
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

              {/* Executor section */}
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <FormLabel className="text-xs font-semibold text-foreground">
                  {t("operations.executorType")}
                </FormLabel>

                <Controller
                  control={form.control}
                  name="executorType"
                  render={({ field }) => {
                    const handleChange = field.onChange;

                    return (
                      <div className="flex gap-2">
                        {EXECUTOR_TYPE_OPTIONS.map(({ value, label, icon: Icon, description }) => {
                          const selected = field.value === value;

                          return (
                            <button
                              key={value}
                              className={cn(
                                "flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                                selected
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted"
                              )}
                              type="button"
                              onClick={() => handleChange(value)}
                            >
                              <span className="flex items-center gap-1.5 font-medium">
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                              </span>
                              <span className="text-[11px] opacity-70">{description}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />

                {executorType === "agent" && (
                  <>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("operations.agentMode")}
                    </FormLabel>
                    <Controller
                      control={form.control}
                      name="agentMode"
                      render={({ field }) => {
                        const handleChange = field.onChange;

                        return (
                          <div className="flex gap-2">
                            {AGENT_MODE_OPTIONS.map(({ value, label, icon: Icon, description }) => {
                              const selected = field.value === value;

                              return (
                                <button
                                  key={value}
                                  className={cn(
                                    "flex flex-1 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                    selected
                                      ? "border-primary/50 bg-primary/10 text-primary"
                                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                                  )}
                                  type="button"
                                  onClick={() => handleChange(value)}
                                >
                                  <span className="flex items-center gap-1.5 font-medium">
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                  </span>
                                  <span className="text-[11px] opacity-70">{description}</span>
                                </button>
                              );
                            })}
                          </div>
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
                                Skill
                              </FormLabel>
                              <FormControl>
                                <Select
                                  open={skillOpen}
                                  value={field.value}
                                  onOpenChange={handleSkillOpenChange}
                                  onValueChange={handleChange}
                                >
                                  <SelectTrigger className="h-9 w-full" onClick={handleSkillToggle}>
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
                                className="resize-none text-sm"
                                placeholder={t("operations.promptPlaceholder")}
                                rows={5}
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
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
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
                                className="h-9 font-mono text-sm"
                                placeholder="e.g. eslint src/ --fix"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
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
                                  className="h-9 w-full"
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

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" type="button" variant="outline" onClick={handleCancel}>
                  {t("common.cancel")}
                </Button>
                <Button disabled={form.formState.isSubmitting} size="sm" type="submit">
                  {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
