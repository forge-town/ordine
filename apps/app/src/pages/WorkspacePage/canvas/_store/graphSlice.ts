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

export const createGraphSlice =
  <T extends GraphSlice = GraphSlice>(
    initialState: GraphSliceInitialState = {},
  ): StateCreator<T, [], [], GraphSlice> =>
  (set, get) => {
    const castGraphState = (state: Partial<GraphSlice>) => state as unknown as Partial<T>;

    return {
      drillStack: [],
      edges: initialState.edges ?? [],
      nodes: sortParentBeforeChildren(initialState.nodes ?? []),
      addNode: (node, childNodes = []) =>
        set((state) =>
          castGraphState({
            nodes: sortParentBeforeChildren([...state.nodes, node, ...childNodes]),
          }),
        ),
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
        const selectedNodes = state.nodes.filter((node) => selectedIdSet.has(node.id));

        if (selectedNodes.length < 2) {
          return null;
        }

        const childEdges = state.edges.filter(
          (edge) => selectedIdSet.has(edge.source) && selectedIdSet.has(edge.target),
        );
        const compound = makeCompoundNode(selectedNodes, childEdges, options);
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

        return compound;
      },
      deleteEdge: (edgeId) =>
        set((state) =>
          castGraphState({
            edges: state.edges.filter((edge) => edge.id !== edgeId),
          }),
        ),
      deleteNode: (nodeId) =>
        set((state) =>
          castGraphState({
            drillStack: state.drillStack.filter((id) => id !== nodeId),
            edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            nodes: state.nodes
              .filter((node) => node.id !== nodeId)
              .map((node) =>
                node.parentId === nodeId
                  ? { ...node, extent: undefined, parentId: undefined }
                  : node,
              ),
          }),
        ),
      deleteSelected: (ids) => {
        const selectedIdSet = new Set(ids);
        if (selectedIdSet.size === 0) {
          return;
        }

        set((state) =>
          castGraphState({
            drillStack: state.drillStack.filter((id) => !selectedIdSet.has(id)),
            edges: state.edges.filter(
              (edge) =>
                !selectedIdSet.has(edge.id) &&
                !selectedIdSet.has(edge.source) &&
                !selectedIdSet.has(edge.target),
            ),
            nodes: state.nodes
              .filter((node) => !selectedIdSet.has(node.id))
              .map((node) =>
                node.parentId && selectedIdSet.has(node.parentId)
                  ? { ...node, extent: undefined, parentId: undefined }
                  : node,
              ),
          }),
        );
      },
      duplicateNode: (nodeId, id) => {
        const source = get().nodes.find((node) => node.id === nodeId);
        if (!source) {
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
          edges: activeCompound.data.childEdges.map(
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

        set((state) =>
          castGraphState({
            edges: addEdge(makeEdge(connection), state.edges),
          }),
        );
      },
      handleEdgesChange: (changes) =>
        set((state) =>
          castGraphState({
            edges: applyEdgeChanges(changes, state.edges),
          }),
        ),
      handleNodesChange: (changes) =>
        set((state) =>
          castGraphState({
            nodes: sortParentBeforeChildren(applyNodeChanges(changes, state.nodes)),
          }),
        ),
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

        const childIdSet = new Set(compound.data.childNodeIds);
        const childEdges = compound.data.childEdges as CanvasEdge[];

        set((current) =>
          castGraphState({
            drillStack: current.drillStack.filter((id) => id !== compoundId),
            edges: [
              ...current.edges.filter(
                (edge) => edge.source !== compoundId && edge.target !== compoundId,
              ),
              ...childEdges,
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
      },
      updateEdgeData: (edgeId, data) =>
        set((state) =>
          castGraphState({
            edges: state.edges.map((edge) =>
              edge.id === edgeId
                ? {
                    ...edge,
                    data: { label: "", ...edge.data, ...data },
                  }
                : edge,
            ),
          }),
        ),
      updateNodeData: (nodeId, data) =>
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
        ),
    };
  };
