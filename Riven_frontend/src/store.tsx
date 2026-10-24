import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { ChatTree, Message, Orientation, Theme } from "./types";
import { detectList, fetchReply, fetchTitle, type ChatTurn } from "./lib/api";
import { shortTitle } from "./lib/title";
import {
  buildIndex,
  buildMergeNode,
  isMergeNode,
  lineage,
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
  orientation: Orientation;
  branchMode: boolean;
  merge: MergeState | null;
  expanded: string[];
}

type Action =
  | { type: "NEW_TREE" }
  | { type: "SELECT_TREE"; id: string }
  | { type: "SELECT_NODE"; id: string | null }
  | { type: "SET_THEME"; theme: Theme }
  | { type: "SET_ORIENTATION"; orientation: Orientation }
  | { type: "SET_TITLE"; treeId: string; title: string; ifCurrent: string }
  | { type: "SET_FAMILY_TITLE"; treeId: string; parentId: string; title: string }
  | { type: "SET_BRANCH_MODE"; on: boolean }
  | { type: "ADD_MESSAGES"; treeId: string; messages: Message[]; select?: string; title?: string }
  | { type: "APPEND_PENDING"; treeId: string; id: string; text: string }
  | { type: "RESOLVE_PENDING"; treeId: string; id: string; text: string; error?: boolean }
  | { type: "MERGE_START"; id: string }
  | { type: "MERGE_TOGGLE"; id: string }
  | { type: "MERGE_CONFIRM" }
  | { type: "MERGE_CANCEL" }
  | { type: "TOGGLE_EXPANDED"; id: string };

const NEW_TITLE = "Новый чат";

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
    case "SET_ORIENTATION":
      return { ...state, orientation: a.orientation };
    case "SET_TITLE":
      // название по смыслу заменяет локальную выжимку, только если её не успели изменить
      return updateTree(state, a.treeId, (t) => (t.title === a.ifCurrent ? { ...t, title: a.title } : t));
    case "SET_FAMILY_TITLE":
      return updateTree(state, a.treeId, (t) => ({
        ...t,
        familyTitles: { ...t.familyTitles, [a.parentId]: a.title },
      }));
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
    case "APPEND_PENDING":
      return updateTree(state, a.treeId, (t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === a.id && m.pending ? { ...m, text: m.text + a.text } : m,
        ),
      }));
    case "RESOLVE_PENDING":
      return updateTree(state, a.treeId, (t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === a.id ? { ...m, text: a.text, pending: false, error: a.error } : m,
        ),
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
  setOrientation: (o: Orientation) => void;
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
  // приложение всегда начинается с пустого нового чата
  const first: ChatTree = { id: uid("t"), title: NEW_TITLE, createdAt: Date.now(), messages: [] };
  return {
    trees: [first],
    currentTreeId: first.id,
    selectedId: null,
    theme: "light",
    orientation: "horizontal",
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

  // Названия семей по смыслу: как только у сообщения появилось 2+ ответвления, просим ИИ
  // придумать общее название. Пока оно не пришло, на плашке стоит локальная выжимка.
  const requestedFamilies = useRef(new Set<string>());
  useEffect(() => {
    for (const tree of state.trees) {
      if (tree.messages.length === 0) continue;
      const idx = buildIndex(tree.messages);
      for (const m of tree.messages) {
        if (m.pending || m.text.trim() === "" || isMergeNode(m)) continue;
        const key = `${tree.id}:${m.id}`;
        if (requestedFamilies.current.has(key) || tree.familyTitles?.[m.id]) continue;
        const kids = (idx.structChildren.get(m.id) ?? []).filter((k) => !idx.consumed.has(k.id));
        const cont = kids.find((k) => k.branch === m.branch && !isMergeNode(k));
        const forks = kids.filter((k) => k !== cont);
        if (forks.length < 2) continue;
        requestedFamilies.current.add(key);
        const texts = [m.text.slice(0, 1200), ...forks.slice(0, 7).map((f) => f.text.slice(0, 200))].filter(
          (t) => t.trim() !== "",
        );
        fetchTitle("family", texts).then((t) => {
          if (t) dispatch({ type: "SET_FAMILY_TITLE", treeId: tree.id, parentId: m.id, title: t });
        });
      }
    }
  }, [state.trees]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const treeId = currentTree.id;
      let userMsg: Message;
      let title: string | undefined;
      let history: Message[] = []; // родословная: что ИИ уже «знает» на этом пути
      if (currentTree.messages.length === 0) {
        userMsg = { id: uid(), parents: [], role: "user", branch: ROOT_BRANCH, text: trimmed };
        title = shortTitle(trimmed, 4); // сразу — локальная выжимка, ниже её заменит название от ИИ
      } else {
        const parent = state.selectedId ? index.byId.get(state.selectedId) : undefined;
        if (!parent || parent.pending) return; // ответ ещё печатается — ждём
        history = lineage(parent.id, index.byId);
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

      // ИИ получает только путь от корня до этого вопроса — соседних веток в нём нет
      const context: ChatTurn[] = [...history, userMsg]
        .filter((m) => !m.pending && !m.error && m.text.trim() !== "")
        .map((m) => ({ role: m.role, content: m.text }));
      fetchReply(context, (chunk) =>
        dispatch({ type: "APPEND_PENDING", treeId, id: reply.id, text: chunk }),
      ).then(
        (text) => dispatch({ type: "RESOLVE_PENDING", treeId, id: reply.id, text }),
        (e: unknown) =>
          dispatch({
            type: "RESOLVE_PENDING",
            treeId,
            id: reply.id,
            text: "⚠ " + (e instanceof Error && e.message ? e.message : "Не удалось получить ответ."),
            error: true,
          }),
      );
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
    setOrientation: (orientation) => dispatch({ type: "SET_ORIENTATION", orientation }),
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
