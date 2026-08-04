import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { StateCreator } from "zustand";
import type { BuiltinNodeType, CompoundNodeData, PipelineEdgeData } from "@repo/schemas";
import { ConnectionRuleSchema } from "@repo/pipeline-engine/schemas";
import { makeDefaultNodeData } from "../utils/makeDefaultNodeData";
import { sortParentBeforeChildren, type CanvasEdge, type CanvasNode } from "./canvasTypes";

const DUPLICATE_OFFSET = { x: 40, y: 40 } as const;
const COMPOUND_PAD = 40;
const COMPOUND_HEADER = 36;
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 120;

export type AddCatalogNodeInput = {
  data?: CanvasNode["data"];
  id?: string;
  label?: string;
  position: CanvasNode["position"];
  type: BuiltinNodeType;
};

export type ComposeNodesOptions = {
  id?: string;
  label?: string;
};

export type VisibleGraph = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

export type GraphSlice = {
  drillStack: string[];
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  addNode: (node: CanvasNode, childNodes?: CanvasNode[]) => void;
  addNodeFromCatalog: (input: AddCatalogNodeInput) => CanvasNode;
  composeNodes: (nodeIds: string[], options?: ComposeNodesOptions) => CanvasNode | null;
  deleteEdge: (edgeId: string) => void;
  deleteNode: (nodeId: string) => void;
  deleteSelected: (ids: string[]) => void;
  duplicateNode: (nodeId: string, id?: string) => CanvasNode | null;
  getVisibleGraph: () => VisibleGraph;
  handleConnect: (connection: Connection) => void;
  handleEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void;
  handleNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  popDrillStack: () => void;
  pushDrillStack: (nodeId: string) => void;
  setDrillStack: (stack: string[]) => void;
  ungroupCompound: (compoundId: string) => void;
  updateEdgeData: (edgeId: string, data: Partial<PipelineEdgeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<CanvasNode["data"]>) => void;
};

type GraphSliceInitialState = {
  edges?: CanvasEdge[];
  nodes?: CanvasNode[];
};

type GraphSnapshot = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

type OptionalGraphHistory = {
  recordHistory?: (previous: GraphSnapshot) => void;
};

const createId = (prefix: string): string => `${prefix}-${globalThis.crypto.randomUUID()}`;

const hasValidConnectionRule = (source: CanvasNode, target: CanvasNode): boolean =>
  ConnectionRuleSchema.safeParse({
    sourceType: source.type,
    targetType: target.type,
  }).success;

const makeEdge = (connection: Connection): CanvasEdge => ({
  ...connection,
  id: `e-${connection.source}-${connection.target}-${globalThis.crypto.randomUUID()}`,
  type: "semantic",
  animated: false,
  data: { label: "" },
});

const makeCompoundNode = (
  selectedNodes: CanvasNode[],
  childEdges: CanvasEdge[],
  boundaryEdges: CanvasEdge[],
  options?: ComposeNodesOptions,
): CanvasNode => {
  const minX = Math.min(...selectedNodes.map((node) => node.position.x));
  const minY = Math.min(...selectedNodes.map((node) => node.position.y));
  const maxX = Math.max(...selectedNodes.map((node) => node.position.x + DEFAULT_NODE_WIDTH));
  const maxY = Math.max(...selectedNodes.map((node) => node.position.y + DEFAULT_NODE_HEIGHT));
  const label = options?.label?.trim() || undefined;

  return {
    id: options?.id ?? createId("compound"),
    type: "compound",
    position: { x: minX - COMPOUND_PAD, y: minY - COMPOUND_PAD - COMPOUND_HEADER },
    style: {
      width: maxX - minX + COMPOUND_PAD * 2,
      height: maxY - minY + COMPOUND_PAD * 2 + COMPOUND_HEADER,
    },
    data: {
      ...(makeDefaultNodeData("compound", { label }) as CompoundNodeData),
      boundaryEdges,
      childEdges,
      childNodeIds: selectedNodes.map((node) => node.id),
    },
  };
};

const isCompoundNode = (
  node: CanvasNode | undefined,
): node is CanvasNode & {
  data: CompoundNodeData;
} => node?.type === "compound";

const detachCompoundChild = (node: CanvasNode): CanvasNode => ({
  ...node,
  extent: undefined,
  parentId: undefined,
});

const boundaryEdgeRewireId = (
  compoundId: string,
  childNodeIds: readonly string[],
  edge: CanvasEdge,
): string => {
  const childIdSet = new Set(childNodeIds);
  const source = childIdSet.has(edge.source) ? compoundId : edge.source;
  const target = childIdSet.has(edge.target) ? compoundId : edge.target;

  return `e-${source}-${target}-${edge.id}`;
};

const withEdgeData = (edge: CanvasEdge, data: Partial<PipelineEdgeData>): CanvasEdge => ({
  ...edge,
  data: { label: "", ...edge.data, ...data },
});

const updateStoredCompoundEdge = (
  node: CanvasNode,
  edgeId: string,
  data: Partial<PipelineEdgeData>,
): CanvasNode => {
  if (!isCompoundNode(node)) {
    return node;
  }

  return {
    ...node,
    data: {
      ...node.data,
      boundaryEdges: (node.data.boundaryEdges ?? []).map((edge) =>
        boundaryEdgeRewireId(node.id, node.data.childNodeIds, edge) === edgeId
          ? withEdgeData(edge, data)
          : edge,
      ),
      childEdges: (node.data.childEdges ?? []).map((edge) =>
        edge.id === edgeId ? withEdgeData(edge, data) : edge,
      ),
    },
  };
};

const removeEdgeReferencesFromCompound = (
  node: CanvasNode,
  removedEdgeIds: ReadonlySet<string>,
): CanvasNode => {
  if (!isCompoundNode(node) || removedEdgeIds.size === 0) {
    return node;
  }

  return {
    ...node,
    data: {
      ...node.data,
      boundaryEdges: (node.data.boundaryEdges ?? []).filter(
        (edge) =>
          !removedEdgeIds.has(edge.id) &&
          !removedEdgeIds.has(boundaryEdgeRewireId(node.id, node.data.childNodeIds, edge)),
      ),
      childEdges: (node.data.childEdges ?? []).filter((edge) => !removedEdgeIds.has(edge.id)),
    },
  };
};

const getRewiredEdgeIdsForRemovedChildren = (
  nodes: readonly CanvasNode[],
  removedNodeIds: ReadonlySet<string>,
): Set<string> =>
  new Set(
    nodes
      .filter(isCompoundNode)
      .flatMap((compound) =>
        (compound.data.boundaryEdges ?? [])
          .filter((edge) => removedNodeIds.has(edge.source) || removedNodeIds.has(edge.target))
          .map((edge) => boundaryEdgeRewireId(compound.id, compound.data.childNodeIds, edge)),
      ),
  );

const removeNodeReferencesFromCompound = (
  node: CanvasNode,
  removedIds: ReadonlySet<string>,
): CanvasNode => {
  if (!isCompoundNode(node)) {
    return node;
  }

  const withoutRemovedEdges = (edges: readonly CanvasEdge[] | undefined): CanvasEdge[] =>
    (edges ?? []).filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target));

  return {
    ...node,
    data: {
      ...node.data,
      boundaryEdges: withoutRemovedEdges(node.data.boundaryEdges),
      childEdges: withoutRemovedEdges(node.data.childEdges),
      childNodeIds: node.data.childNodeIds.filter((id) => !removedIds.has(id)),
    },
  };
};

export const createGraphSlice =
  <T extends GraphSlice & OptionalGraphHistory = GraphSlice>(
    initialState: GraphSliceInitialState = {},
  ): StateCreator<T, [], [], GraphSlice> =>
  (set, get) => {
    const castGraphState = (state: Partial<GraphSlice>) => state as unknown as Partial<T>;
    const getGraphSnapshot = (): GraphSnapshot => ({ edges: get().edges, nodes: get().nodes });
    const recordGraphChange = (previous: GraphSnapshot) => get().recordHistory?.(previous);
    const dragHistory = { start: null as GraphSnapshot | null };

    return {
      drillStack: [],
      edges: initialState.edges ?? [],
      nodes: sortParentBeforeChildren(initialState.nodes ?? []),
      addNode: (node, childNodes = []) => {
        const previous = getGraphSnapshot();
        set((state) =>
          castGraphState({
            nodes: sortParentBeforeChildren([...state.nodes, node, ...childNodes]),
          }),
        );
        recordGraphChange(previous);
      },
      addNodeFromCatalog: (input) => {
        const node: CanvasNode = {
          id: input.id ?? createId(input.type),
          type: input.type,
          position: input.position,
          data: input.data ?? makeDefaultNodeData(input.type, { label: input.label }),
        };
        get().addNode(node);

        return node;
      },
      composeNodes: (nodeIds, options) => {
        const state = get();
        const selectedIdSet = new Set(nodeIds);
        const selectedNodes = state.nodes.filter(
          (node) => selectedIdSet.has(node.id) && !node.parentId && node.type !== "compound",
        );

        if (selectedNodes.length < 2 || selectedNodes.length !== selectedIdSet.size) {
          return null;
        }

        const previous = getGraphSnapshot();
        const childEdges = state.edges.filter(
          (edge) => selectedIdSet.has(edge.source) && selectedIdSet.has(edge.target),
        );
        const boundaryEdges = state.edges.filter(
          (edge) => selectedIdSet.has(edge.source) !== selectedIdSet.has(edge.target),
        );
        const compound = makeCompoundNode(selectedNodes, childEdges, boundaryEdges, options);
        const rewiredEdges: CanvasEdge[] = [];
        const untouchedEdges: CanvasEdge[] = [];

        for (const edge of state.edges) {
          const sourceSelected = selectedIdSet.has(edge.source);
          const targetSelected = selectedIdSet.has(edge.target);

          if (sourceSelected && targetSelected) {
            continue;
          }

          if (sourceSelected !== targetSelected) {
            const source = sourceSelected ? compound.id : edge.source;
            const target = targetSelected ? compound.id : edge.target;
            rewiredEdges.push({
              ...edge,
              id: `e-${source}-${target}-${edge.id}`,
              source,
              sourceHandle: sourceSelected ? null : edge.sourceHandle,
              target,
              targetHandle: targetSelected ? null : edge.targetHandle,
            });
            continue;
          }

          untouchedEdges.push(edge);
        }

        set((current) =>
          castGraphState({
            edges: [...untouchedEdges, ...rewiredEdges],
            nodes: sortParentBeforeChildren([
              ...current.nodes.map((node) =>
                selectedIdSet.has(node.id)
                  ? {
                      ...node,
                      extent: "parent" as const,
                      parentId: compound.id,
                      position: {
                        x: node.position.x - compound.position.x,
                        y: node.position.y - compound.position.y,
                      },
                    }
                  : node,
              ),
              compound,
            ]),
          }),
        );
        recordGraphChange(previous);

        return compound;
      },
      deleteEdge: (edgeId) => {
        const previous = getGraphSnapshot();
        set((state) =>
          castGraphState({
            edges: state.edges.filter((edge) => edge.id !== edgeId),
            nodes: state.nodes.map((node) =>
              removeEdgeReferencesFromCompound(node, new Set([edgeId])),
            ),
          }),
        );
        recordGraphChange(previous);
      },
      deleteNode: (nodeId) => {
        const previous = getGraphSnapshot();
        set((state) => {
          const compound = state.nodes.find((node) => node.id === nodeId);
          const removedIds = new Set([nodeId]);
          const removedRewiredEdgeIds = getRewiredEdgeIdsForRemovedChildren(
            state.nodes,
            removedIds,
          );
          const restoredEdges = isCompoundNode(compound)
            ? [...(compound.data.childEdges ?? []), ...(compound.data.boundaryEdges ?? [])]
            : [];

          return castGraphState({
            drillStack: state.drillStack.filter((id) => id !== nodeId),
            edges: [
              ...state.edges.filter(
                (edge) =>
                  edge.source !== nodeId &&
                  edge.target !== nodeId &&
                  !removedRewiredEdgeIds.has(edge.id),
              ),
              ...restoredEdges,
            ],
            nodes: state.nodes
              .filter((node) => node.id !== nodeId)
              .map((node) =>
                node.parentId === nodeId
                  ? {
                      ...node,
                      extent: undefined,
                      parentId: undefined,
                      position: {
                        x: node.position.x + (compound?.position.x ?? 0),
                        y: node.position.y + (compound?.position.y ?? 0),
                      },
                    }
                  : removeNodeReferencesFromCompound(node, removedIds),
              ),
          });
        });
        recordGraphChange(previous);
      },
      deleteSelected: (ids) => {
        const selectedIdSet = new Set(ids);
        if (selectedIdSet.size === 0) {
          return;
        }

        const previous = getGraphSnapshot();
        set((state) => {
          const removedCompounds = state.nodes
            .filter(isCompoundNode)
            .filter((node) => selectedIdSet.has(node.id));
          const compoundById = new Map(removedCompounds.map((node) => [node.id, node]));
          const removedRewiredEdgeIds = getRewiredEdgeIdsForRemovedChildren(
            state.nodes,
            selectedIdSet,
          );
          const restoredEdges = removedCompounds.flatMap((compound) => [
            ...(compound.data.childEdges ?? []).map((edge) => ({ edge, rewiredId: null })),
            ...(compound.data.boundaryEdges ?? []).map((edge) => ({
              edge,
              rewiredId: boundaryEdgeRewireId(compound.id, compound.data.childNodeIds, edge),
            })),
          ]);

          return castGraphState({
            drillStack: state.drillStack.filter((id) => !selectedIdSet.has(id)),
            edges: [
              ...state.edges.filter(
                (edge) =>
                  !selectedIdSet.has(edge.id) &&
                  !selectedIdSet.has(edge.source) &&
                  !selectedIdSet.has(edge.target) &&
                  !removedRewiredEdgeIds.has(edge.id),
              ),
              ...restoredEdges
                .filter(
                  ({ edge, rewiredId }) =>
                    !selectedIdSet.has(edge.id) &&
                    !selectedIdSet.has(edge.source) &&
                    !selectedIdSet.has(edge.target) &&
                    (!rewiredId || !selectedIdSet.has(rewiredId)),
                )
                .map(({ edge }) => edge),
            ],
            nodes: state.nodes
              .filter((node) => !selectedIdSet.has(node.id))
              .map((node) =>
                node.parentId && selectedIdSet.has(node.parentId)
                  ? {
                      ...node,
                      extent: undefined,
                      parentId: undefined,
                      position: {
                        x: node.position.x + (compoundById.get(node.parentId)?.position.x ?? 0),
                        y: node.position.y + (compoundById.get(node.parentId)?.position.y ?? 0),
                      },
                    }
                  : removeEdgeReferencesFromCompound(
                      removeNodeReferencesFromCompound(node, selectedIdSet),
                      selectedIdSet,
                    ),
              ),
          });
        });
        recordGraphChange(previous);
      },
      duplicateNode: (nodeId, id) => {
        const source = get().nodes.find((node) => node.id === nodeId);
        if (!source || source.type === "compound") {
          return null;
        }

        const node: CanvasNode = {
          ...source,
          id: id ?? createId(source.type),
          position: {
            x: source.position.x + DUPLICATE_OFFSET.x,
            y: source.position.y + DUPLICATE_OFFSET.y,
          },
          selected: false,
          data: { ...source.data },
        };
        get().addNode(node);

        return node;
      },
      getVisibleGraph: () => {
        const state = get();
        const activeCompoundId = state.drillStack.at(-1);
        const activeCompound = state.nodes.find((node) => node.id === activeCompoundId);

        if (!isCompoundNode(activeCompound)) {
          return { edges: state.edges, nodes: state.nodes };
        }

        const childIdSet = new Set(activeCompound.data.childNodeIds);

        return {
          edges: (activeCompound.data.childEdges ?? []).map(
            (edge): CanvasEdge => ({
              ...edge,
              animated: false,
              type: "semantic",
            }),
          ),
          nodes: state.nodes.filter((node) => childIdSet.has(node.id)).map(detachCompoundChild),
        };
      },
      handleConnect: (connection) => {
        const source = get().nodes.find((node) => node.id === connection.source);
        const target = get().nodes.find((node) => node.id === connection.target);

        if (!source || !target || !hasValidConnectionRule(source, target)) {
          return;
        }

        const previous = getGraphSnapshot();
        const edge = makeEdge(connection);
        set((state) => {
          const activeCompoundId = state.drillStack.at(-1);
          const activeCompound = state.nodes.find((node) => node.id === activeCompoundId);
          const activeChildIds = isCompoundNode(activeCompound)
            ? new Set(activeCompound.data.childNodeIds)
            : null;

          if (
            isCompoundNode(activeCompound) &&
            activeChildIds?.has(connection.source) &&
            activeChildIds.has(connection.target)
          ) {
            return castGraphState({
              nodes: state.nodes.map((node) =>
                node.id === activeCompound.id
                  ? {
                      ...node,
                      data: {
                        ...activeCompound.data,
                        childEdges: addEdge(edge, activeCompound.data.childEdges ?? []),
                      },
                    }
                  : node,
              ),
            });
          }

          return castGraphState({ edges: addEdge(edge, state.edges) });
        });
        recordGraphChange(previous);
      },
      handleEdgesChange: (changes) => {
        const previous = getGraphSnapshot();
        set((state) => {
          const activeCompoundId = state.drillStack.at(-1);
          const activeCompound = state.nodes.find((node) => node.id === activeCompoundId);
          if (isCompoundNode(activeCompound)) {
            return castGraphState({
              nodes: state.nodes.map((node) =>
                node.id === activeCompound.id
                  ? {
                      ...node,
                      data: {
                        ...activeCompound.data,
                        childEdges: applyEdgeChanges(changes, activeCompound.data.childEdges ?? []),
                      },
                    }
                  : node,
              ),
            });
          }

          const removedEdgeIds = new Set(
            changes.filter((change) => change.type === "remove").map((change) => change.id),
          );

          return castGraphState({
            edges: applyEdgeChanges(changes, state.edges),
            nodes: state.nodes.map((node) =>
              removeEdgeReferencesFromCompound(node, removedEdgeIds),
            ),
          });
        });
        if (changes.some((change) => change.type !== "select")) {
          recordGraphChange(previous);
        }
      },
      handleNodesChange: (changes) => {
        const removedNodeIds = changes
          .filter((change) => change.type === "remove")
          .map((change) => change.id);
        if (removedNodeIds.length > 0) {
          get().deleteSelected(removedNodeIds);
          const remainingChanges = changes.filter((change) => change.type !== "remove");
          if (remainingChanges.length > 0) {
            get().handleNodesChange(remainingChanges);
          }

          return;
        }

        const continuesDrag = changes.some(
          (change) => change.type === "position" && change.dragging === true,
        );
        const endsDrag = changes.some(
          (change) => change.type === "position" && change.dragging === false,
        );
        const shouldRecord = changes.some(
          (change) => change.type !== "select" && change.type !== "dimensions",
        );
        const previous = continuesDrag
          ? null
          : (endsDrag && dragHistory.start) || (shouldRecord ? getGraphSnapshot() : null);
        if (continuesDrag) {
          dragHistory.start ??= getGraphSnapshot();
        }
        if (endsDrag) {
          dragHistory.start = null;
        }

        set((state) =>
          castGraphState({
            nodes: sortParentBeforeChildren(applyNodeChanges(changes, state.nodes)),
          }),
        );
        if (previous) {
          recordGraphChange(previous);
        }
      },
      popDrillStack: () =>
        set((state) =>
          castGraphState({
            drillStack: state.drillStack.slice(0, -1),
          }),
        ),
      pushDrillStack: (nodeId) =>
        set((state) =>
          castGraphState({
            drillStack: [...state.drillStack, nodeId],
          }),
        ),
      setDrillStack: (stack) => set(castGraphState({ drillStack: [...stack] })),
      ungroupCompound: (compoundId) => {
        const state = get();
        const compound = state.nodes.find((node) => node.id === compoundId);

        if (!isCompoundNode(compound)) {
          return;
        }

        const previous = getGraphSnapshot();
        const childIdSet = new Set(compound.data.childNodeIds);
        const childEdges = compound.data.childEdges ?? [];
        const boundaryEdges = compound.data.boundaryEdges ?? [];

        set((current) =>
          castGraphState({
            drillStack: current.drillStack.filter((id) => id !== compoundId),
            edges: [
              ...current.edges.filter(
                (edge) => edge.source !== compoundId && edge.target !== compoundId,
              ),
              ...childEdges,
              ...boundaryEdges,
            ],
            nodes: current.nodes
              .filter((node) => node.id !== compoundId)
              .map((node) =>
                childIdSet.has(node.id)
                  ? {
                      ...node,
                      extent: undefined,
                      parentId: undefined,
                      position: {
                        x: node.position.x + compound.position.x,
                        y: node.position.y + compound.position.y,
                      },
                    }
                  : node,
              ),
          }),
        );
        recordGraphChange(previous);
      },
      updateEdgeData: (edgeId, data) => {
        const previous = getGraphSnapshot();
        set((state) =>
          castGraphState({
            edges: state.edges.map((edge) =>
              edge.id === edgeId ? withEdgeData(edge, data) : edge,
            ),
            nodes: state.nodes.map((node) => updateStoredCompoundEdge(node, edgeId, data)),
          }),
        );
        recordGraphChange(previous);
      },
      updateNodeData: (nodeId, data) => {
        const previous = getGraphSnapshot();
        set((state) =>
          castGraphState({
            nodes: state.nodes.map((node) =>
              node.id === nodeId
                ? ({
                    ...node,
                    data: { ...node.data, ...data } as CanvasNode["data"],
                  } as CanvasNode)
                : node,
            ),
          }),
        );
        recordGraphChange(previous);
      },
    };
  };
