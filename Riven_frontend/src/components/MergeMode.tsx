import { useStore } from "../store";
import { displayBranch, useLang, useT } from "../lib/i18n";

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
  const t = useT();
  const lang = useLang();
  if (!state.merge) return null;
  const anchor = index.byId.get(state.merge.anchorId);
  const n = state.merge.selected.length;
  return (
    <div className="merge-bar">
      <span className="caption">{t.merge}</span>
      <span>
        {t.mergeHint(displayBranch(anchor?.branch ?? "", lang), mergeCandidates.size, n)}
      </span>
      <button className="btn btn-primary" disabled={n === 0} onClick={mergeConfirm}>
        {t.mergeBtn(n)}
      </button>
      <button className="btn" onClick={mergeCancel}>
        {t.cancel}
      </button>
    </div>
  );
}
