import { useStore } from "zustand";
import {
  useHarnessCanvasStore,
  type PipelineNode,
  type PipelineEdge,
  type SkillNodeData,
  type ConditionNodeData,
  type InputNodeData,
  type OutputNodeData,
} from "../_store";
import { X, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Separator } from "@repo/ui/separator";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Field } from "./Field";

export const PropertiesPanel = () => {
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const selectedEdgeId = useStore(store, (state) => state.selectedEdgeId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);

  const selectedNode = nodes.find((n: PipelineNode) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e: PipelineEdge) => e.id === selectedEdgeId);

  if (!selectedNode && !selectedEdge) return null;

  const handleClose = () => {
    store.getState().selectNode(null);
    store.getState().selectEdge(null);
    store.getState().closePropertiesPanel();
  };

  const update = (data: Record<string, unknown>) => {
    if (selectedNode) store.getState().updateNodeData(selectedNode.id, data);
  };

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-72 border-l bg-background shadow-lg overflow-hidden flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">属性</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {selectedNode && (
            <>
              <Field label="标签">
                <Input
                  value={selectedNode.data.label}
                  onChange={(e) => update({ label: e.target.value })}
                />
              </Field>

              {selectedNode.data.nodeType === "skill" &&
                (() => {
                  const d = selectedNode.data as SkillNodeData;
                  return (
                    <>
                      <Field label="Skill 名称">
                        <Input
                          className="font-mono"
                          value={d.skillName}
                          onChange={(e) =>
                            update({ skillName: e.target.value })
                          }
                          placeholder="e.g. page-best-practice"
                        />
                      </Field>
                      <Field label="参数 (JSON)">
                        <Textarea
                          rows={4}
                          className="font-mono"
                          value={d.params}
                          onChange={(e) => update({ params: e.target.value })}
                          placeholder='{ "key": "value" }'
                        />
                      </Field>
                      <Field label="验收条件">
                        <Textarea
                          rows={3}
                          value={d.acceptanceCriteria}
                          onChange={(e) =>
                            update({ acceptanceCriteria: e.target.value })
                          }
                          placeholder="描述 skill 调用必须满足的验收条件"
                        />
                      </Field>
                      <Field label="备注">
                        <Textarea
                          rows={2}
                          value={d.notes ?? ""}
                          onChange={(e) => update({ notes: e.target.value })}
                        />
                      </Field>
                    </>
                  );
                })()}

              {selectedNode.data.nodeType === "condition" &&
                (() => {
                  const d = selectedNode.data as ConditionNodeData;
                  return (
                    <>
                      <Field label="条件表达式">
                        <Textarea
                          rows={3}
                          className="font-mono"
                          value={d.expression}
                          onChange={(e) =>
                            update({ expression: e.target.value })
                          }
                          placeholder="e.g. output.files.length > 0 && tsc === 0"
                        />
                      </Field>
                      <Field label="期望结果">
                        <Input
                          value={d.expectedResult}
                          onChange={(e) =>
                            update({ expectedResult: e.target.value })
                          }
                          placeholder="e.g. 所有检查项通过"
                        />
                      </Field>
                      <Field label="备注">
                        <Textarea
                          rows={2}
                          value={d.notes ?? ""}
                          onChange={(e) => update({ notes: e.target.value })}
                        />
                      </Field>
                    </>
                  );
                })()}

              {selectedNode.data.nodeType === "input" &&
                (() => {
                  const d = selectedNode.data as InputNodeData;
                  return (
                    <>
                      <Field label="上下文描述">
                        <Textarea
                          rows={3}
                          value={d.contextDescription}
                          onChange={(e) =>
                            update({ contextDescription: e.target.value })
                          }
                          placeholder="描述此 pipeline 的需求背景"
                        />
                      </Field>
                      <Field label="示例输入">
                        <Textarea
                          rows={3}
                          className="font-mono"
                          value={d.exampleValue}
                          onChange={(e) =>
                            update({ exampleValue: e.target.value })
                          }
                        />
                      </Field>
                    </>
                  );
                })()}

              {selectedNode.data.nodeType === "output" &&
                (() => {
                  const d = selectedNode.data as OutputNodeData;
                  return (
                    <>
                      <Field label="期望产出 Schema">
                        <Textarea
                          rows={4}
                          className="font-mono"
                          value={d.expectedSchema}
                          onChange={(e) =>
                            update({ expectedSchema: e.target.value })
                          }
                          placeholder="{ pages: string[], dao: string[] }"
                        />
                      </Field>
                      <Field label="备注">
                        <Textarea
                          rows={2}
                          value={d.notes ?? ""}
                          onChange={(e) => update({ notes: e.target.value })}
                        />
                      </Field>
                    </>
                  );
                })()}

              <div className="pt-1">
                <Separator className="mb-3" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    store.getState().removeNode(selectedNode.id);
                    handleClose();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除节点
                </Button>
              </div>
            </>
          )}

          {selectedEdge && !selectedNode && (
            <>
              <Field label="边标签">
                <Input
                  value={selectedEdge.data?.label ?? ""}
                  onChange={(e) =>
                    store
                      .getState()
                      .updateEdgeData(selectedEdge.id, {
                        label: e.target.value,
                      })
                  }
                />
              </Field>
              <Field label="数据类型">
                <Input
                  className="font-mono"
                  value={selectedEdge.data?.dataType ?? ""}
                  placeholder="e.g. context / artifact / result"
                  onChange={(e) =>
                    store.getState().updateEdgeData(selectedEdge.id, {
                      dataType: e.target.value,
                    })
                  }
                />
              </Field>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
