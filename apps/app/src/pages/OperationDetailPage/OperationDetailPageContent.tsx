import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  FileInput,
  FileOutput,
  Info,
  Tag,
  XCircle,
  Globe,
  Lock,
  Users,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { updateOperation } from "@/services/operationsService";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { ObjectType, Visibility } from "@/models/tables/operations_table";

// ─── Config types (mirrors seed definition) ──────────────────────────────────

type PortKind = "text" | "file" | "folder" | "project";

interface InputPort {
  name: string;
  kind: PortKind;
  required: boolean;
  description: string;
}

interface OutputPort {
  name: string;
  kind: PortKind;
  path: string;
  description: string;
}

interface OperationConfig {
  inputs: InputPort[];
  outputs: OutputPort[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};

const KIND_LABEL: Record<PortKind, string> = {
  text: "text",
  file: "file",
  folder: "folder",
  project: "project",
};

const VISIBILITY_CONFIG: Record<
  Visibility,
  { icon: React.ElementType; label: string; cls: string; next: Visibility }
> = {
  public: {
    icon: Globe,
    label: "public",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    next: "team",
  },
  team: {
    icon: Users,
    label: "team",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
    next: "private",
  },
  private: {
    icon: Lock,
    label: "private",
    cls: "bg-rose-50 text-rose-700 border-rose-200",
    next: "public",
  },
};

const parseConfig = (raw: string): OperationConfig => {
  try {
    const parsed = JSON.parse(raw) as Partial<OperationConfig>;
    return {
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) => (
  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    <Icon className="h-3.5 w-3.5" />
    {label}
  </div>
);

const InputPortRow = ({ port }: { port: InputPort }) => (
  <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">
          {port.name}
        </span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {KIND_LABEL[port.kind]}
        </span>
        {port.required && (
          <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
            必填
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {port.description}
      </p>
    </div>
  </div>
);

const OutputPortRow = ({ port }: { port: OutputPort }) => (
  <div className="flex items-start gap-3 border-b border-border/50 py-2.5 last:border-0">
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">
          {port.name}
        </span>
        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {KIND_LABEL[port.kind]}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {port.description}
      </p>
      <p className="font-mono text-[11px] text-muted-foreground/60">
        {port.path}
      </p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const OperationDetailPageContent = ({
  operation,
}: {
  operation: OperationEntity | null;
}) => {
  const navigate = useNavigate();
  const [visibility, setVisibility] = useState<Visibility>(
    operation?.visibility ?? "public",
  );
  const [toggling, setToggling] = useState(false);

  const handleNavigateBack = () => void navigate({ to: "/operations" });

  const handleVisibilityToggle = async () => {
    if (!operation) return;
    const next = VISIBILITY_CONFIG[visibility].next;
    setToggling(true);
    try {
      await updateOperation({ data: { id: operation.id, visibility: next } });
      setVisibility(next);
    } finally {
      setToggling(false);
    }
  };

  const handleVisibilityClick = () => void handleVisibilityToggle();

  if (!operation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          Operation 不存在
        </p>
        <button
          className="text-xs text-primary hover:underline"
          onClick={handleNavigateBack}
        >
          返回列表
        </button>
      </div>
    );
  }

  const config = parseConfig(operation.config);
  const vc = VISIBILITY_CONFIG[visibility];
  const VisibilityIcon = vc.icon;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label="返回列表"
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {operation.name}
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground">
            {operation.id}
          </p>
        </div>
        <Badge variant="secondary">{operation.category}</Badge>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Meta card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Info} label="基本信息" />

          {operation.description && (
            <p className="mb-4 text-sm leading-relaxed text-foreground">
              {operation.description}
            </p>
          )}

          {/* Visibility control */}
          <div className="mb-3 flex items-center justify-between">
            <span className="shrink-0 text-xs text-muted-foreground">
              可见性
            </span>
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity",
                vc.cls,
                toggling && "cursor-not-allowed opacity-50",
              )}
              disabled={toggling}
              title="点击切换可见性"
              onClick={handleVisibilityClick}
            >
              <VisibilityIcon className="h-3 w-3" />
              {vc.label}
            </button>
          </div>

          {/* Accepted object types */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              适用对象
            </span>
            <div className="flex flex-wrap gap-1.5">
              {operation.acceptedObjectTypes.map((type) => {
                const Icon = OBJECT_TYPE_ICONS[type];
                return (
                  <span
                    key={type}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {type}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Inputs card */}
        {config.inputs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionHeader
              icon={FileInput}
              label={`输入 (${config.inputs.length})`}
            />
            <div>
              {config.inputs.map((port) => (
                <InputPortRow key={port.name} port={port} />
              ))}
            </div>
          </div>
        )}

        {/* Outputs card */}
        {config.outputs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionHeader
              icon={FileOutput}
              label={`输出 (${config.outputs.length})`}
            />
            <div>
              {config.outputs.map((port) => (
                <OutputPortRow key={port.name} port={port} />
              ))}
            </div>
          </div>
        )}

        {/* Category + timestamps card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Tag} label="元数据" />
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                创建时间
              </span>
              <span className="text-xs text-foreground">
                {new Date(operation.createdAt).toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                更新时间
              </span>
              <span className="text-xs text-foreground">
                {new Date(operation.updatedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
