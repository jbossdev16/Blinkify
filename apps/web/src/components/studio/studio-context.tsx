"use client";

import React, { createContext, useCallback, useContext, useReducer, useRef } from "react";
import type { LeftPanelTab, StudioNode } from "./types";

const PAGE_WIDTH = 1080;
const PAGE_HEIGHT = 1080;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface StudioState {
  leftPanelTab: LeftPanelTab;
  contentPanelSearch: string;
  templatesSameSizeOnly: boolean;
  nodes: StudioNode[];
  selectedIds: string[];
  zoom: number;
  past: StudioNode[][];
  future: StudioNode[][];
  stageSize: { width: number; height: number };
  pageSize: { width: number; height: number };
}

const initialState: StudioState = {
  leftPanelTab: "templates",
  contentPanelSearch: "",
  templatesSameSizeOnly: true,
  nodes: [],
  selectedIds: [],
  zoom: 0.32,
  past: [],
  future: [],
  stageSize: { width: 800, height: 600 },
  pageSize: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
};

type Action =
  | { type: "SET_LEFT_PANEL_TAB"; payload: LeftPanelTab }
  | { type: "SET_CONTENT_PANEL_SEARCH"; payload: string }
  | { type: "SET_TEMPLATES_SAME_SIZE_ONLY"; payload: boolean }
  | { type: "SET_NODES"; payload: StudioNode[] }
  | { type: "SET_STAGE_SIZE"; payload: { width: number; height: number } }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_SELECTION"; payload: string[] }
  | { type: "ADD_NODE"; payload: StudioNode }
  | { type: "UPDATE_NODE"; payload: { id: string; attrs: Partial<StudioNode> } }
  | { type: "REMOVE_NODES"; payload: string[] }
  | { type: "DUPLICATE_SELECTION" }
  | { type: "TOGGLE_LOCK_SELECTION" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "APPLY_TEMPLATE"; payload: StudioNode[] };

function pushHistory(state: StudioState, nextNodes: StudioNode[]): StudioState {
  const past = [...state.past, state.nodes];
  const future: StudioNode[][] = [];
  return { ...state, nodes: nextNodes, past, future };
}

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "SET_LEFT_PANEL_TAB":
      return { ...state, leftPanelTab: action.payload };
    case "SET_CONTENT_PANEL_SEARCH":
      return { ...state, contentPanelSearch: action.payload };
    case "SET_TEMPLATES_SAME_SIZE_ONLY":
      return { ...state, templatesSameSizeOnly: action.payload };
    case "SET_NODES":
      return { ...state, nodes: action.payload };
    case "SET_STAGE_SIZE":
      return { ...state, stageSize: action.payload };
    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(2, action.payload)) };
    case "SET_SELECTION":
      return { ...state, selectedIds: action.payload };
    case "ADD_NODE":
      return pushHistory(state, [...state.nodes, action.payload]);
    case "UPDATE_NODE": {
      const nodes = state.nodes.map((n) =>
        n.id === action.payload.id ? { ...n, ...action.payload.attrs } : n
      );
      return { ...state, nodes };
    }
    case "REMOVE_NODES": {
      const ids = new Set(action.payload);
      const next = state.nodes.filter((n) => !ids.has(n.id));
      return pushHistory(state, next);
    }
    case "DUPLICATE_SELECTION": {
      if (state.selectedIds.length === 0) return state;
      const newNodes: StudioNode[] = [];
      state.nodes.forEach((n) => {
        if (state.selectedIds.includes(n.id)) {
          const copy = { ...n, id: generateId(), x: n.x + 20, y: n.y + 20 } as StudioNode;
          newNodes.push(copy);
        }
      });
      return pushHistory(state, [...state.nodes, ...newNodes]);
    }
    case "TOGGLE_LOCK_SELECTION": {
      if (state.selectedIds.length === 0) return state;
      const nodes = state.nodes.map((n) =>
        state.selectedIds.includes(n.id) ? { ...n, locked: !n.locked } : n
      );
      return { ...state, nodes };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const past = state.past.slice(0, -1);
      const nodes = state.past[state.past.length - 1] ?? state.nodes;
      const future = [...state.future, state.nodes];
      return { ...state, nodes, past, future, selectedIds: [] };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1] ?? state.nodes;
      const future = state.future.slice(0, -1);
      const past = [...state.past, state.nodes];
      return { ...state, nodes: next, past, future, selectedIds: [] };
    }
    case "APPLY_TEMPLATE":
      return pushHistory(state, action.payload);
    default:
      return state;
  }
}

interface StudioContextValue extends StudioState {
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  setContentPanelSearch: (q: string) => void;
  setTemplatesSameSizeOnly: (v: boolean) => void;
  setStageSize: (size: { width: number; height: number }) => void;
  setZoom: (z: number) => void;
  setSelection: (ids: string[]) => void;
  addNode: (node: Omit<StudioNode, "id">) => void;
  updateNode: (id: string, attrs: Partial<StudioNode>) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  toggleLockSelected: () => void;
  undo: () => void;
  redo: () => void;
  applyTemplateNodes: (nodes: StudioNode[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  selectedNode: StudioNode | null;
  exportCanvas: () => void;
  registerExportCanvas: (fn: (() => void) | null) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setLeftPanelTab = useCallback((tab: LeftPanelTab) => {
    dispatch({ type: "SET_LEFT_PANEL_TAB", payload: tab });
  }, []);
  const setContentPanelSearch = useCallback((q: string) => {
    dispatch({ type: "SET_CONTENT_PANEL_SEARCH", payload: q });
  }, []);
  const setTemplatesSameSizeOnly = useCallback((v: boolean) => {
    dispatch({ type: "SET_TEMPLATES_SAME_SIZE_ONLY", payload: v });
  }, []);
  const setStageSize = useCallback((size: { width: number; height: number }) => {
    dispatch({ type: "SET_STAGE_SIZE", payload: size });
  }, []);
  const setZoom = useCallback((z: number) => {
    dispatch({ type: "SET_ZOOM", payload: z });
  }, []);
  const setSelection = useCallback((ids: string[]) => {
    dispatch({ type: "SET_SELECTION", payload: ids });
  }, []);
  const addNode = useCallback((node: Omit<StudioNode, "id">) => {
    dispatch({ type: "ADD_NODE", payload: { ...node, id: generateId() } as StudioNode });
  }, []);
  const updateNode = useCallback((id: string, attrs: Partial<StudioNode>) => {
    dispatch({ type: "UPDATE_NODE", payload: { id, attrs } });
  }, []);
  const removeSelected = useCallback(() => {
    if (state.selectedIds.length) dispatch({ type: "REMOVE_NODES", payload: state.selectedIds });
  }, [state.selectedIds]);
  const duplicateSelected = useCallback(() => {
    dispatch({ type: "DUPLICATE_SELECTION" });
  }, []);
  const toggleLockSelected = useCallback(() => {
    dispatch({ type: "TOGGLE_LOCK_SELECTION" });
  }, []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const applyTemplateNodes = useCallback((nodes: StudioNode[]) => {
    const withIds = nodes.map((n) => ({ ...n, id: generateId() }));
    dispatch({ type: "APPLY_TEMPLATE", payload: withIds });
  }, []);

  const exportCanvasRef = useRef<(() => void) | null>(null);
  const registerExportCanvas = useCallback((fn: (() => void) | null) => {
    exportCanvasRef.current = fn;
  }, []);
  const exportCanvas = useCallback(() => {
    exportCanvasRef.current?.();
  }, []);

  const selectedNode =
    state.selectedIds.length === 1
      ? state.nodes.find((n) => n.id === state.selectedIds[0]) ?? null
      : null;

  const value: StudioContextValue = {
    ...state,
    setLeftPanelTab,
    setContentPanelSearch,
    setTemplatesSameSizeOnly,
    setStageSize,
    setZoom,
    setSelection,
    addNode,
    updateNode,
    removeSelected,
    duplicateSelected,
    toggleLockSelected,
    undo,
    redo,
    applyTemplateNodes,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    selectedNode,
    exportCanvas,
    registerExportCanvas,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}

export { PAGE_WIDTH, PAGE_HEIGHT };
