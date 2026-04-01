import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Layers } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Route } from "@/routes/pipelines";
import { createPipeline, deletePipeline } from "@/services/pipelinesService";
import type { StoredPipeline } from "@/models/daos/pipelinesDao";
import { PipelineCard } from "./components/PipelineCard";

export const PipelinesPageContent = () => {
  const loaderPipelines = Route.useLoaderData();
  const [pipelines, setPipelines] =
    React.useState<StoredPipeline[]>(loaderPipelines);
  const navigate = useNavigate();

  const openPipeline = (id: string) => {
    void navigate({ to: "/canvas", search: { id } });
  };

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = Date.now();
    const newPipeline: StoredPipeline = {
      id,
      name: "新建 Pipeline",
      description: "在 Canvas 中配置此 Pipeline 的节点和连接。",
      tags: [],
      nodeCount: 1,
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: `${id}-output`,
          type: "output",
          position: { x: 300, y: 200 },
          data: {
            label: "输出",
            nodeType: "output",
            expectedSchema: "",
            notes: "",
          },
        },
      ],
      edges: [],
    };
    const saved = (await createPipeline({
      data: newPipeline,
    })) as StoredPipeline;
    setPipelines((prev) => [saved, ...prev]);
    void navigate({ to: "/canvas", search: { id: saved.id } });
  };

  const handleDelete = async (id: string) => {
    setPipelines((prev) => prev.filter((p) => p.id !== id));
    await deletePipeline({ data: { id } });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">Pipelines</h1>
          <p className="text-xs text-muted-foreground">
            {pipelines.length} 个 Pipeline
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void handleCreate()}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          新建 Pipeline
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {pipelines.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm">
              还没有 Pipeline，点击「新建 Pipeline」开始
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                onOpen={() => openPipeline(p.id)}
                onDelete={() => void handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
