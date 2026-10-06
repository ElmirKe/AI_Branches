import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "../store";
import { isMergeNode, lineage, plural, sisters } from "../lib/layout";

export function BranchPanel() {
  const { state, index, selectNode, setBranchMode, sendMessage, mergeStart } = useStore();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const selected = state.selectedId ? index.byId.get(state.selectedId) : undefined;
  const line = selected ? lineage(selected.id, index.byId) : [];
  const n = line.length;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.selectedId, n, selected?.pending]);

  if (!selected) return null;

  const sis = sisters(selected.id, index);
  const consumed = index.consumed.has(selected.id);
  const merging = state.merge !== null;
  // точка уже продолжена той же веткой — новое сообщение станет ответвлением автоматически
  const forcedBranch = (index.structChildren.get(selected.id) ?? []).some(
    (k) => k.branch === selected.branch && !isMergeNode(k),
  );
  const branchOn = state.branchMode || forcedBranch;
  const canSend = text.trim().length > 0 && !merging && !selected.pending;

  const submit = () => {
    if (!canSend) return;
    sendMessage(text);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <aside className="panel">
      <div className="panel-head">
        <h2 title={selected.branch}>{selected.branch}</h2>
        <button className="icon-btn" aria-label="Закрыть" onClick={() => selectNode(null)}>
          ×
        </button>
      </div>

      <div className="panel-msgs" ref={listRef}>
        {line.map((m) => {
          const merge = isMergeNode(m);
          return (
            <div key={m.id} className={"msg" + (merge ? " merge" : "")}>
              <span className="caption">{merge ? "Слияние" : m.role === "user" ? "Вы" : "Ассистент"}</span>
              <div className="msg-text">{m.pending ? <span className="pending">Печатает…</span> : m.text}</div>
            </div>
          );
        })}
        <div className="caption panel-hint">
          Модель видит только эту линию — {n} {plural(n, "сообщение", "сообщения", "сообщений")} от начала.
        </div>
      </div>

      <div className="panel-tools">
        <button
          className={"btn" + (branchOn ? " active" : "")}
          disabled={merging || forcedBranch}
          title={forcedBranch ? "Эта точка уже продолжена — сообщение создаст новую ветку" : undefined}
          onClick={() => setBranchMode(!state.branchMode)}
        >
          Ответвить
        </button>
        {sis.length > 0 && !consumed && (
          <button className="btn" disabled={merging} onClick={() => mergeStart(selected.id)}>
            Свести
          </button>
        )}
      </div>

      <div className="composer">
        {branchOn && (
          <div className="caption composer-note">
            {forcedBranch ? "Точка уже продолжена — сообщение откроет новую ветку" : "Новая ветка от этого узла"}
          </div>
        )}
        <textarea
          value={text}
          disabled={merging}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={branchOn ? "Сообщение новой ветки…" : "Продолжить ветку… (Enter — отправить, Shift+Enter — перенос)"}
        />
        <div className="composer-actions">
          <button className="btn btn-primary" disabled={!canSend} onClick={submit}>
            {branchOn ? "Ответвить" : "Отправить"}
          </button>
        </div>
      </div>
    </aside>
  );
}
