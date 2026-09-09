import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { useWorkspaceData } from "./useWorkspaceData";
import { newPipeline } from "./_store";
import { TextField } from "./TextField";
import { PortsEditor } from "./PortsEditor";
import { PipelineCanvas } from "./PipelineCanvas";
import { NodeInspector } from "./NodeInspector";
import { BindingsEditor } from "./BindingsEditor";
import { useSavePipeline } from "./useSavePipeline";
export const PipelineWorkspace = () => {
  const { pipeline, pipelines, edit, store, state, act, busy } = useWorkspaceData();
  const save = useSavePipeline();
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    if (state.dirty) {
      store.getState().patch({ error: "当前有未保存修改，请先保存或放弃修改。" });

      return;
    }
    store.getState().edit(newPipeline());
  };
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void pipelines.query.refetch();
  const handleClick4: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    if (!pipeline) return;

    const saved = pipelines.result.data.find((entry) => entry.id === pipeline.id);
    if (saved) store.getState().choosePipeline(structuredClone(saved));
  };
  const handleClick5: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    if (!pipeline) return;

    return void act("保存 Pipeline", () => save(pipeline));
  };
  const handleClick6: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    store.getState().patch({ tab: "run" });
  const handleChange7: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (name) =>
    edit((current) => ({ ...current, name }));
  const handleChange8: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    description,
  ) => edit((current) => ({ ...current, description }));
  const handleChange9: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    sharedContext,
  ) => edit((current) => ({ ...current, sharedContext }));
  const handleChange10: NonNullable<React.ComponentProps<typeof PortsEditor>["onChange"]> = (
    inputs,
  ) =>
    edit((current) => ({
      ...current,
      graph: {
        ...current.graph,
        inputs,
        edges: current.graph.edges.filter(
          (edge) =>
            edge.source.kind !== "input" || inputs.some((port) => port.id === edge.source.portId),
        ),
      },
    }));

  return (
    <fieldset className="min-w-0 space-y-5" disabled={busy}>
      <Card className="p-4" variant="surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Pipelines</h2>
          <Button size="sm" variant="ghost" onClick={handleClick2}>
            刷新列表
          </Button>
          <Button disabled={busy} size="sm" onClick={handleClick1}>
            新建 Pipeline
          </Button>
        </div>
        {pipelines.query.isLoading && (
          <p className="mt-3 text-sm" role="status">
            正在加载 Pipelines…
          </p>
        )}
        {pipelines.query.error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {pipelines.query.error.message}
            <Button variant="ghost" onClick={handleClick2}>
              重新加载
            </Button>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {pipelines.result.data.map((entry) => {
            const handleClick3: NonNullable<
              React.ComponentProps<typeof Button>["onClick"]
            > = () => {
              if (state.dirty) {
                store.getState().patch({ error: "当前有未保存修改，请先保存或放弃修改。" });

                return;
              }
              store.getState().choosePipeline(structuredClone(entry));
            };

            return (
              <Button
                key={entry.id}
                disabled={busy}
                variant={pipeline?.id === entry.id ? "secondary" : "outline"}
                onClick={handleClick3}
              >
                {entry.name} · r{entry.revision}
              </Button>
            );
          })}
        </div>
        {pipelines.result.data.length === 0 && !pipelines.query.isLoading && (
          <p className="mt-3 text-sm text-muted-foreground">
            尚无 Pipeline。创建后添加 Operation 节点和端口绑定。
          </p>
        )}
      </Card>
      {pipeline && (
        <>
          <Card className="space-y-4 p-5" variant="surface">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{pipeline.name || "未命名 Pipeline"}</h2>
                <p className="text-xs text-muted-foreground">
                  {state.dirty ? "有未保存修改" : `已保存修订 r${pipeline.revision}`} · 执行协议 v2
                </p>
              </div>
              <div className="flex gap-2">
                <Button disabled={busy || !state.dirty} variant="outline" onClick={handleClick4}>
                  放弃修改
                </Button>
                <Button disabled={busy || pipeline.graph.nodes.length === 0} onClick={handleClick5}>
                  保存 Pipeline
                </Button>
                <Button
                  disabled={busy || pipeline.graph.nodes.length === 0}
                  variant="outline"
                  onClick={handleClick6}
                >
                  配置运行
                </Button>
              </div>
            </div>
            <fieldset className="space-y-3" disabled={busy}>
              <TextField label="Pipeline 名称" value={pipeline.name} onChange={handleChange7} />
              <TextField label="说明" value={pipeline.description} onChange={handleChange8} />
              <details>
                <summary className="cursor-pointer text-sm">共享上下文</summary>
                <div className="pt-3">
                  <TextField
                    multiline
                    label="传给各节点的共享上下文"
                    value={pipeline.sharedContext}
                    onChange={handleChange9}
                  />
                </div>
              </details>
            </fieldset>
          </Card>
          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
            <PipelineCanvas />
            <NodeInspector />
          </div>
          <Card className="p-5" variant="surface">
            <PortsEditor
              label="Pipeline 输入端口"
              ports={pipeline.graph.inputs}
              onChange={handleChange10}
            />
          </Card>
          <BindingsEditor />
          {pipeline.editor.groups.length > 0 && (
            <Card className="space-y-3 p-5" variant="surface">
              <h2 className="font-semibold">视觉分组</h2>
              {pipeline.editor.groups.map((group) => {
                const handleChange11: NonNullable<
                  React.ComponentProps<typeof TextField>["onChange"]
                > = (label) =>
                  edit((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      groups: current.editor.groups.map((item) =>
                        item.id === group.id ? { ...item, label } : item,
                      ),
                    },
                  }));
                const handleClick12: NonNullable<
                  React.ComponentProps<typeof Button>["onClick"]
                > = () =>
                  edit((current) => ({
                    ...current,
                    editor: {
                      ...current.editor,
                      groups: current.editor.groups.filter((item) => item.id !== group.id),
                    },
                  }));

                return (
                  <div key={group.id} className="flex items-end gap-3">
                    <div className="min-w-0 flex-1">
                      <TextField label="分组名称" value={group.label} onChange={handleChange11} />
                    </div>
                    <Button variant="ghost" onClick={handleClick12}>
                      删除分组
                    </Button>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </fieldset>
  );
};
