import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { ChatTree, Message, Theme } from "./types";
import { detectList, generateReply, replyDelay } from "./lib/api";
import {
  buildIndex,
  buildMergeNode,
  isMergeNode,
  ROOT_BRANCH,
  sisters,
  truncate,
  uid,
  type TreeIndex,
} from "./lib/layout";

export interface MergeState {
  anchorId: string;
  selected: string[];
}

export interface State {
  trees: ChatTree[];
  currentTreeId: string;
  selectedId: string | null;
  theme: Theme;
  branchMode: boolean;
  merge: MergeState | null;
  expanded: string[];
}

type Action =
  | { type: "NEW_TREE" }
  | { type: "SELECT_TREE"; id: string }
  | { type: "SELECT_NODE"; id: string | null }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_BRANCH_MODE"; on: boolean }
  | { type: "ADD_MESSAGES"; treeId: string; messages: Message[]; select?: string; title?: string }
  | { type: "RESOLVE_PENDING"; treeId: string; id: string; text: string }
  | { type: "MERGE_START"; id: string }
  | { type: "MERGE_TOGGLE"; id: string }
  | { type: "MERGE_CONFIRM" }
  | { type: "MERGE_CANCEL" }
  | { type: "TOGGLE_EXPANDED"; id: string };

const NEW_TITLE = "Новый чат";

/** Демо-дерево: вопрос → план из 4 шагов, разложенный на сестёр, одна продолжена. */
function seedTree(): ChatTree {
  const plan = generateReply("план");
  const items = detectList(plan);
  const sistersMsgs: Message[] = items.map((item, i) => ({
    id: `s${i + 1}`,
    parents: ["r2"],
    role: "assistant",
    branch: truncate(item, 32),
    text: item,
  }));
  const s2 = sistersMsgs[1];
  return {
    id: "demo",
    title: "Как спланировать запуск продукта?",
    createdAt: Date.now(),
    messages: [
      { id: "r1", parents: [], role: "user", branch: ROOT_BRANCH, text: "Как спланировать запуск продукта?" },
      { id: "r2", parents: ["r1"], role: "assistant", branch: ROOT_BRANCH, text: plan },
      ...sistersMsgs,
      {
        id: "u1",
        parents: [s2.id],
        role: "user",
        branch: s2.branch,
        text: "С чего начать сборку минимальной версии, если команда — два человека?",
      },
      { id: "a1", parents: ["u1"], role: "assistant", branch: s2.branch, text: generateReply("с чего начать") },
    ],
  };
}

function updateTree(state: State, treeId: string, fn: (t: ChatTree) => ChatTree): State {
  return { ...state, trees: state.trees.map((t) => (t.id === treeId ? fn(t) : t)) };
}

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "NEW_TREE": {
      const empty = state.trees.find((t) => t.messages.length === 0);
      if (empty) return { ...state, currentTreeId: empty.id, selectedId: null, merge: null, branchMode: false };
      const t: ChatTree = { id: uid("t"), title: NEW_TITLE, createdAt: Date.now(), messages: [] };
      return { ...state, trees: [t, ...state.trees], currentTreeId: t.id, selectedId: null, merge: null, branchMode: false };
    }
    case "SELECT_TREE":
      return { ...state, currentTreeId: a.id, selectedId: null, merge: null, branchMode: false };
    case "SELECT_NODE":
      return { ...state, selectedId: a.id, branchMode: false };
    case "SET_THEME":
      return { ...state, theme: a.theme };
    case "SET_BRANCH_MODE":
      return { ...state, branchMode: a.on };
    case "ADD_MESSAGES": {
      const s = updateTree(state, a.treeId, (t) => ({
        ...t,
        title: a.title ?? t.title,
        messages: [...t.messages, ...a.messages],
      }));
      return { ...s, selectedId: a.select ?? s.selectedId, branchMode: false };
    }
    case "RESOLVE_PENDING":
      return updateTree(state, a.treeId, (t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === a.id ? { ...m, text: a.text, pending: false } : m)),
      }));
    case "MERGE_START":
      return { ...state, merge: { anchorId: a.id, selected: [] } };
    case "MERGE_TOGGLE": {
      if (!state.merge) return state;
      const sel = state.merge.selected.includes(a.id)
        ? state.merge.selected.filter((x) => x !== a.id)
        : [...state.merge.selected, a.id];
      return { ...state, merge: { ...state.merge, selected: sel } };
    }
    case "MERGE_CONFIRM": {
      if (!state.merge || state.merge.selected.length === 0) return state;
      const tree = state.trees.find((t) => t.id === state.currentTreeId);
      if (!tree) return state;
      const node = buildMergeNode(tree.messages, [state.merge.anchorId, ...state.merge.selected]);
      const s = updateTree(state, tree.id, (t) => ({ ...t, messages: [...t.messages, node] }));
      return { ...s, merge: null, selectedId: node.id, branchMode: false };
    }
    case "MERGE_CANCEL":
      return { ...state, merge: null };
    case "TOGGLE_EXPANDED":
      return {
        ...state,
        expanded: state.expanded.includes(a.id)
          ? state.expanded.filter((x) => x !== a.id)
          : [...state.expanded, a.id],
      };
  }
}

export interface Store {
  state: State;
  currentTree: ChatTree;
  index: TreeIndex;
  expandedSet: Set<string>;
  mergeCandidates: Set<string>;
  newTree: () => void;
  selectTree: (id: string) => void;
  selectNode: (id: string | null) => void;
  setTheme: (t: Theme) => void;
  setBranchMode: (on: boolean) => void;
  sendMessage: (text: string) => void;
  decompose: (id: string) => void;
  mergeStart: (id: string) => void;
  mergeToggle: (id: string) => void;
  mergeConfirm: () => void;
  mergeCancel: () => void;
  toggleExpanded: (id: string) => void;
}

const StoreContext = createContext<Store | null>(null);

function initialState(): State {
  const demo = seedTree();
  return {
    trees: [demo],
    currentTreeId: demo.id,
    selectedId: null,
    theme: "light",
    branchMode: false,
    merge: null,
    expanded: [],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const currentTree = state.trees.find((t) => t.id === state.currentTreeId) ?? state.trees[0];
  const index = useMemo(() => buildIndex(currentTree.messages), [currentTree.messages]);
  const expandedSet = useMemo(() => new Set(state.expanded), [state.expanded]);
  const mergeCandidates = useMemo(
    () => new Set(state.merge ? sisters(state.merge.anchorId, index).map((m) => m.id) : []),
    [state.merge, index],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const treeId = currentTree.id;
      let userMsg: Message;
      let title: string | undefined;
      if (currentTree.messages.length === 0) {
        userMsg = { id: uid(), parents: [], role: "user", branch: ROOT_BRANCH, text: trimmed };
        title = truncate(trimmed, 40);
      } else {
        const parent = state.selectedId ? index.byId.get(state.selectedId) : undefined;
        if (!parent) return;
        // если точка уже продолжена той же веткой — новое сообщение становится ответвлением
        const hasCont = (index.structChildren.get(parent.id) ?? []).some(
          (k) => k.branch === parent.branch && !isMergeNode(k),
        );
        const fork = state.branchMode || hasCont;
        userMsg = {
          id: uid(),
          parents: [parent.id],
          role: "user",
          branch: fork ? truncate(trimmed, 28) : parent.branch,
          text: trimmed,
        };
      }
      const reply: Message = {
        id: uid(),
        parents: [userMsg.id],
        role: "assistant",
        branch: userMsg.branch,
        text: "",
        pending: true,
      };
      dispatch({ type: "ADD_MESSAGES", treeId, messages: [userMsg, reply], select: reply.id, title });
      window.setTimeout(() => {
        dispatch({ type: "RESOLVE_PENDING", treeId, id: reply.id, text: generateReply(trimmed) });
      }, replyDelay());
    },
    [currentTree, index, state.selectedId, state.branchMode],
  );

  const decompose = useCallback(
    (id: string) => {
      const m = index.byId.get(id);
      if (!m) return;
      const items = detectList(m.text);
      if (items.length < 2) return;
      const kids: Message[] = items.map((item) => ({
        id: uid(),
        parents: [id],
        role: "assistant",
        branch: truncate(item, 32),
        text: item,
      }));
      dispatch({ type: "ADD_MESSAGES", treeId: currentTree.id, messages: kids });
    },
    [index, currentTree.id],
  );

  const value: Store = {
    state,
    currentTree,
    index,
    expandedSet,
    mergeCandidates,
    newTree: () => dispatch({ type: "NEW_TREE" }),
    selectTree: (id) => dispatch({ type: "SELECT_TREE", id }),
    selectNode: (id) => dispatch({ type: "SELECT_NODE", id }),
    setTheme: (theme) => dispatch({ type: "SET_THEME", theme }),
    setBranchMode: (on) => dispatch({ type: "SET_BRANCH_MODE", on }),
    sendMessage,
    decompose,
    mergeStart: (id) => dispatch({ type: "MERGE_START", id }),
    mergeToggle: (id) => dispatch({ type: "MERGE_TOGGLE", id }),
    mergeConfirm: () => dispatch({ type: "MERGE_CONFIRM" }),
    mergeCancel: () => dispatch({ type: "MERGE_CANCEL" }),
    toggleExpanded: (id) => dispatch({ type: "TOGGLE_EXPANDED", id }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
