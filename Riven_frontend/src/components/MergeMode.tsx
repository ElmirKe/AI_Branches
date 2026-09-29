import { useStore } from "../store";
import { plural } from "../lib/layout";

export type MergeVisual = "none" | "anchor" | "candidate" | "picked" | "dimmed";

/** Как карточка выглядит в режиме выбора для слияния. */
export function useMergeVisual(id: string): MergeVisual {
  const { state, mergeCandidates } = useStore();
  if (!state.merge) return "none";
  if (state.merge.anchorId === id) return "anchor";
  if (mergeCandidates.has(id)) return state.merge.selected.includes(id) ? "picked" : "candidate";
  return "dimmed";
}

/** Панель управления режимом слияния (показывается в шапке холста). */
export function MergeMode() {
  const { state, index, mergeCandidates, mergeConfirm, mergeCancel } = useStore();
  if (!state.merge) return null;
  const anchor = index.byId.get(state.merge.anchorId);
  const n = state.merge.selected.length;
  return (
    <div className="merge-bar">
      <span className="caption">Слияние</span>
      <span>
        Отметьте сестёр ветки «{anchor?.branch}» на холсте — доступно {mergeCandidates.size}, выбрано {n}
      </span>
      <button className="btn btn-primary" disabled={n === 0} onClick={mergeConfirm}>
        Свести {n > 0 ? `${n + 1} ${plural(n + 1, "ветку", "ветки", "веток")}` : ""}
      </button>
      <button className="btn" onClick={mergeCancel}>
        Отмена
      </button>
    </div>
  );
}
