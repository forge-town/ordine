import { useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  Globe,
  Lock,
  Users,
} from "lucide-react";
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@repo/ui/form";
import { updateOperation } from "@/services/operationsService";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { ObjectType, Visibility } from "@/models/tables/operations_table";
import {
  ObjectTypeSchema as ObjectTypeEnum,
  VisibilitySchema as VisibilityEnum,
} from "@/schemas";

const CATEGORIES = [
  "general",
  "lint",
  "format",
  "build",
  "test",
  "deploy",
  "custom",
] as const;

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "public", label: "公开", icon: Globe },
  { value: "team", label: "团队", icon: Users },
  { value: "private", label: "私有", icon: Lock },
];

const OBJECT_TYPE_OPTIONS: {
  value: ObjectType;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "file", label: "文件", icon: FileCode },
  { value: "folder", label: "文件夹", icon: Folder },
  { value: "project", label: "整个项目", icon: FolderGit2 },
];

const editFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  category: z.string(),
  visibility: VisibilityEnum,
  config: z.string(),
  acceptedObjectTypes: z.array(ObjectTypeEnum).min(1),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface Props {
  operation: OperationEntity;
}

export const OperationEditPageContent = ({ operation }: Props) => {
  const navigate = useNavigate();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: operation.name,
      description: operation.description ?? "",
      category: operation.category,
      visibility: operation.visibility ?? "public",
      config: operation.config,
      acceptedObjectTypes: Array.isArray(operation.acceptedObjectTypes)
        ? [...operation.acceptedObjectTypes]
        : ["file", "folder", "project"],
    },
  });

  const handleCancel = () => {
    navigate({
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
        visibility: values.visibility,
        config: values.config,
        acceptedObjectTypes: values.acceptedObjectTypes,
      },
    });
    navigate({
      to: "/operations/$operationId",
      params: { operationId: operation.id },
    });
  };

  const toggleObjectType = (
    current: ObjectType[],
    type: ObjectType,
  ): ObjectType[] => {
    if (current.includes(type)) {
      if (current.length === 1) return current;
      return current.filter((t) => t !== type);
    }
    return [...current, type];
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label="返回"
          className="h-8 w-8"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">
          编辑 Operation
        </h1>
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
                        名称 *
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="h-9 text-sm"
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        分类
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
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
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      描述
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 text-sm"
                        placeholder="简单描述这个操作做什么"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      可见性
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {VISIBILITY_OPTIONS.map(
                          ({ value, label, icon: Icon }) => {
                            const selected = field.value === value;
                            return (
                              <button
                                key={value}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                  selected
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                                )}
                                type="button"
                                onClick={() => field.onChange(value)}
                              >
                                <Icon className="h-4 w-4" />
                                {label}
                                {selected && (
                                  <span className="ml-1 text-xs">✓</span>
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <Controller
                control={form.control}
                name="acceptedObjectTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      可应用的对象类型
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {OBJECT_TYPE_OPTIONS.map(
                          ({ value, label, icon: Icon }) => {
                            const selected = field.value.includes(value);
                            return (
                              <button
                                key={value}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                  selected
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                                )}
                                type="button"
                                onClick={() =>
                                  field.onChange(
                                    toggleObjectType(field.value, value),
                                  )
                                }
                              >
                                <Icon className="h-4 w-4" />
                                {label}
                                {selected && (
                                  <span className="ml-1 text-xs">✓</span>
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      配置 (JSON)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none font-mono text-xs"
                        placeholder='{ "command": "eslint src/" }'
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  取消
                </Button>
                <Button
                  disabled={form.formState.isSubmitting}
                  size="sm"
                  type="submit"
                >
                  {form.formState.isSubmitting ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
