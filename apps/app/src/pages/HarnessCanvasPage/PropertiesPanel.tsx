import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import type {
  SkillNodeData,
  ConditionNodeData,
  InputNodeData,
  OutputNodeData,
} from "./_store";
import { X, Trash2 } from "lucide-react";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {label}
    </label>
    <div className="mt-1">{children}</div>
  </div>
);

const inputCls =
  "w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400";
const textareaCls =
  "w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none font-mono";

export const PropertiesPanel = () => {
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const selectedEdgeId = useStore(store, (state) => state.selectedEdgeId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

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
    <div className="absolute right-0 top-0 z-10 h-full w-72 border-l border-gray-200 bg-white shadow-lg overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">属性</h3>
        <button
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {selectedNode && (
          <>
            <Field label="标签">
              <input
                className={inputCls}
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
                      <input
                        className={inputCls + " font-mono"}
                        value={d.skillName}
                        onChange={(e) => update({ skillName: e.target.value })}
                        placeholder="e.g. page-best-practice"
                      />
                    </Field>
                    <Field label="参数 (JSON)">
                      <textarea
                        className={textareaCls}
                        rows={4}
                        value={d.params}
                        onChange={(e) => update({ params: e.target.value })}
                        placeholder='{ "key": "value" }'
                      />
                    </Field>
                    <Field label="验收条件">
                      <textarea
                        className={textareaCls.replace("font-mono", "")}
                        rows={3}
                        value={d.acceptanceCriteria}
                        onChange={(e) =>
                          update({ acceptanceCriteria: e.target.value })
                        }
                        placeholder="描述 skill 调用必须满足的验收条件"
                      />
                    </Field>
                    <Field label="备注">
                      <textarea
                        className={textareaCls.replace("font-mono", "")}
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
                      <textarea
                        className={textareaCls}
                        rows={3}
                        value={d.expression}
                        onChange={(e) => update({ expression: e.target.value })}
                        placeholder="e.g. output.files.length > 0 && tsc === 0"
                      />
                    </Field>
                    <Field label="期望结果">
                      <input
                        className={inputCls}
                        value={d.expectedResult}
                        onChange={(e) =>
                          update({ expectedResult: e.target.value })
                        }
                        placeholder="e.g. 所有检查项通过"
                      />
                    </Field>
                    <Field label="备注">
                      <textarea
                        className={textareaCls.replace("font-mono", "")}
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
                      <textarea
                        className={textareaCls.replace("font-mono", "")}
                        rows={3}
                        value={d.contextDescription}
                        onChange={(e) =>
                          update({ contextDescription: e.target.value })
                        }
                        placeholder="描述此 pipeline 的需求背景"
                      />
                    </Field>
                    <Field label="示例输入">
                      <textarea
                        className={textareaCls}
                        rows={3}
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
                      <textarea
                        className={textareaCls}
                        rows={4}
                        value={d.expectedSchema}
                        onChange={(e) =>
                          update({ expectedSchema: e.target.value })
                        }
                        placeholder="{ pages: string[], dao: string[] }"
                      />
                    </Field>
                    <Field label="备注">
                      <textarea
                        className={textareaCls.replace("font-mono", "")}
                        rows={2}
                        value={d.notes ?? ""}
                        onChange={(e) => update({ notes: e.target.value })}
                      />
                    </Field>
                  </>
                );
              })()}

            <div className="pt-1">
              <button
                onClick={() => {
                  store.getState().removeNode(selectedNode.id);
                  handleClose();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-red-200 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除节点
              </button>
            </div>
          </>
        )}

        {selectedEdge && !selectedNode && (
          <>
            <Field label="边标签">
              <input
                className={inputCls}
                value={selectedEdge.data?.label ?? ""}
                onChange={(e) =>
                  store
                    .getState()
                    .updateEdgeData(selectedEdge.id, { label: e.target.value })
                }
              />
            </Field>
            <Field label="数据类型">
              <input
                className={inputCls + " font-mono"}
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
    </div>
  );
};
