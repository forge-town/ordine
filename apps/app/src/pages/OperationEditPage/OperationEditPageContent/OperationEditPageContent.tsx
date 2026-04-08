import { useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { ArrowLeft, FileCode, Folder, FolderGit2, Puzzle, Terminal, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import { updateOperation } from "@/services/operationsService";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { ObjectType } from "@/models/tables/operations_table";
import {
  ObjectTypeSchema as ObjectTypeEnum,
  ExecutorTypeSchema as ExecutorTypeEnum,
  ScriptLanguageSchema as ScriptLanguageEnum,
  type ExecutorType,
} from "@/schemas";

const CATEGORIES = ["general", "lint", "format", "build", "test", "deploy", "custom"] as const;

const EXECUTOR_ICONS = {
  skill: Puzzle,
  prompt: Wand2,
  script: Terminal,
} as const satisfies Record<string, React.ElementType>;

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};

const editFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  category: z.string(),
  acceptedObjectTypes: z.array(ObjectTypeEnum).min(1),
  executorType: ExecutorTypeEnum,
  skillId: z.string(),
  promptText: z.string(),
  scriptCommand: z.string(),
  scriptLanguage: ScriptLanguageEnum,
});

const buildConfig = (values: EditFormValues): string => {
  if (values.executorType === "skill") {
    return JSON.stringify({
      executor: { type: "skill", skillId: values.skillId },
    });
  }
  if (values.executorType === "prompt") {
    return JSON.stringify({
      executor: { type: "prompt", prompt: values.promptText },
    });
  }
  return JSON.stringify({
    executor: {
      type: "script",
      command: values.scriptCommand,
      language: values.scriptLanguage,
    },
  });
};

const parseExecutorDefaults = (
  config: string
): {
  executorType: ExecutorType;
  skillId: string;
  promptText: string;
  scriptCommand: string;
  scriptLanguage: "bash" | "python" | "javascript";
} => {
  try {
    const parsed = JSON.parse(config) as { executor?: Record<string, string> };
    const ex = parsed.executor;
    if (!ex)
      return {
        executorType: "script",
        skillId: "",
        promptText: "",
        scriptCommand: "",
        scriptLanguage: "bash",
      };
    const exType = ["skill", "prompt", "script"].includes(ex.type ?? "")
      ? (ex.type as ExecutorType)
      : "script";
    return {
      executorType: exType,
      skillId: ex.skillId ?? "",
      promptText: ex.prompt ?? "",
      scriptCommand: ex.command ?? "",
      scriptLanguage: (["bash", "python", "javascript"].includes(ex.language ?? "")
        ? ex.language
        : "bash") as "bash" | "python" | "javascript",
    };
  } catch {
    return {
      executorType: "script",
      skillId: "",
      promptText: "",
      scriptCommand: "",
      scriptLanguage: "bash",
    };
  }
};

type EditFormValues = z.infer<typeof editFormSchema>;

const toggleObjectType = (current: ObjectType[], type: ObjectType): ObjectType[] => {
  if (current.includes(type)) {
    if (current.length === 1) return current;
    return current.filter((t) => t !== type);
  }
  return [...current, type];
};

import type { SkillEntity } from "@/models/daos/skillsDao";

interface Props {
  operation: OperationEntity;
  skills: SkillEntity[];
}

export const OperationEditPageContent = ({ operation, skills }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const EXECUTOR_TYPE_OPTIONS = [
    {
      value: "skill" as const,
      label: "Skill",
      icon: EXECUTOR_ICONS.skill,
      description: t("operations.executorSkillDesc"),
    },
    {
      value: "prompt" as const,
      label: "Prompt",
      icon: EXECUTOR_ICONS.prompt,
      description: t("operations.executorPromptDesc"),
    },
    {
      value: "script" as const,
      label: "Script",
      icon: EXECUTOR_ICONS.script,
      description: t("operations.executorScriptDesc"),
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
      category: operation.category,
      acceptedObjectTypes: Array.isArray(operation.acceptedObjectTypes)
        ? [...operation.acceptedObjectTypes]
        : ["file", "folder", "project"],
      ...parseExecutorDefaults(operation.config),
    },
  });

  const executorType = form.watch("executorType");

  const handleCancel = () => {
    void navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  const onSubmit = async (values: EditFormValues) => {
    await updateOperation({
      data: {
        id: operation.id,
        name: values.name,
        description: values.description || null,
        category: values.category,
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
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label={t("common.back")}
          className="h-8 w-8"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">{t("operations.editOperation")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-2 gap-4">
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
                  name="category"
                  render={({ field }) => {
                    const handleChange = field.onChange;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("operations.categoryLabel")}
                        </FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={handleChange}>
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
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

                {executorType === "skill" && (
                  <FormField
                    control={form.control}
                    name="skillId"
                    render={({ field }) => {
                      const handleChange = field.onChange;
                      return (
                        <FormItem>
                          <FormLabel className="text-xs font-medium text-muted-foreground">
                            Skill
                          </FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={handleChange}>
                              <SelectTrigger className="h-9 w-full">
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

                {executorType === "prompt" && (
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
                        const handleChange = field.onChange;
                        return (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              {t("operations.scriptLanguage")}
                            </FormLabel>
                            <FormControl>
                              <Select value={field.value} onValueChange={handleChange}>
                                <SelectTrigger className="h-9 w-full">
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
