import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { createDecisionSlice, type DecisionSlice } from "./decisionSlice";
import { createGraphSlice, type GraphSlice } from "./graphSlice";
import { createHistorySlice, type HistorySlice } from "./historySlice";
import { createPanelSlice, type PanelSlice } from "./panelSlice";
import { createProposalSlice, type ProposalSlice } from "./proposalSlice";
import { createRunSlice, type RunSlice } from "./runSlice";
import { createSelectionSlice, type SelectionSlice } from "./selectionSlice";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

export type CanvasStoreState = DecisionSlice &
  GraphSlice &
  HistorySlice &
  PanelSlice &
  ProposalSlice &
  RunSlice &
  SelectionSlice;

export type CanvasStore = StoreApi<CanvasStoreState>;

type CanvasStoreInitialState = {
  edges?: CanvasEdge[];
  nodes?: CanvasNode[];
};

type UseCanvasStore = {
  <T>(selector: (state: CanvasStoreState) => T): T;
  getInitialState: CanvasStore["getInitialState"];
  getState: CanvasStore["getState"];
  setState: CanvasStore["setState"];
  subscribe: CanvasStore["subscribe"];
};

export const createCanvasStore = (initialState: CanvasStoreInitialState = {}): CanvasStore =>
  createStore<CanvasStoreState>()((set, get, store) => ({
    ...createGraphSlice<CanvasStoreState>(initialState)(set, get, store),
    ...createHistorySlice<CanvasStoreState>()(set, get, store),
    ...createPanelSlice<CanvasStoreState>()(set, get, store),
    ...createRunSlice<CanvasStoreState>()(set, get, store),
    ...createSelectionSlice<CanvasStoreState>()(set, get, store),
    ...createProposalSlice<CanvasStoreState>()(set, get, store),
    ...createDecisionSlice<CanvasStoreState>()(set, get, store),
  }));

export const CanvasStoreContext = createContext<CanvasStore | null>(null);

const defaultCanvasStore = createCanvasStore();

export const CanvasStoreProvider = ({
  children,
  edges,
  nodes,
}: {
  children: ReactNode;
  edges?: CanvasEdge[];
  nodes?: CanvasNode[];
}) => {
  const storeRef = useRef<CanvasStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createCanvasStore({ edges, nodes });
  }

  return createElement(CanvasStoreContext.Provider, { value: storeRef.current }, children);
};

function useCanvasStoreSelector<T>(selector: (state: CanvasStoreState) => T): T {
  const store = useContext(CanvasStoreContext) ?? defaultCanvasStore;

  return useStore(store, selector);
}

export const useCanvasStore = Object.assign(useCanvasStoreSelector, {
  getInitialState: defaultCanvasStore.getInitialState,
  getState: defaultCanvasStore.getState,
  setState: defaultCanvasStore.setState,
  subscribe: defaultCanvasStore.subscribe,
}) satisfies UseCanvasStore;
