import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { X } from "lucide-react";
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
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import {
  createBestPractice,
  updateBestPractice,
} from "@/services/bestPracticesService";
import { CATEGORIES, LANGUAGES } from "../constants";

const formSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  condition: z.string().min(1, "适用时机不能为空"),
  category: z.string(),
  language: z.string(),
  codeSnippet: z.string(),
  tags: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export type PracticeFormDialogProps = {
  initial?: BestPracticeEntity;
  onClose: () => void;
  onSave: (p: BestPracticeEntity) => void;
};

export const PracticeFormDialog = ({
  initial,
  onClose,
  onSave,
}: PracticeFormDialogProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          title: initial.title,
          condition: initial.condition,
          category: initial.category,
          language: initial.language,
          codeSnippet: initial.codeSnippet,
          tags: initial.tags.join(", "),
        }
      : {
          title: "",
          condition: "",
          category: "general",
          language: "typescript",
          codeSnippet: "",
          tags: "",
        },
  });

  const onSubmit = async (values: FormValues) => {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (initial) {
      const updated = await updateBestPractice({
        data: {
          id: initial.id,
          patch: { ...values, tags },
        },
      });
      if (updated) onSave(updated);
    } else {
      const created = await createBestPractice({
        data: {
          id: `bp-${Date.now()}`,
          title: values.title.trim(),
          condition: values.condition.trim(),
          category: values.category,
          language: values.language,
          codeSnippet: values.codeSnippet,
          tags,
        },
      });
      onSave(created);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? "编辑最佳实践" : "新增最佳实践"}
          </h2>
          <Button
            className="h-7 w-7"
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <Form {...form}>
          <form
            className="space-y-4 overflow-y-auto p-5"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    标题 *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 避免在 useEffect 中直接 setState"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    适用时机 (Condition) *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-none"
                      placeholder="描述什么情况下应该遵循这个实践，例如：当需要在组件挂载后获取异步数据时..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
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
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {CATEGORIES.filter((c) => c.value !== "all").map(
                              (c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ),
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      语言
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {LANGUAGES.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
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
              name="codeSnippet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    代码片段
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-y font-mono text-xs leading-relaxed"
                      placeholder="// 在这里粘贴代码示例..."
                      rows={8}
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    标签 (逗号分隔)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="react, hooks, async" {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="flex shrink-0 justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
