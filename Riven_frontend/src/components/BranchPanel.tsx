import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "../store";
import { isMergeNode, lineage, sisters } from "../lib/layout";
import { displayBranch, useLang, useT } from "../lib/i18n";
import { IconBranch, IconMerge, IconSend } from "./Icons";
import { AttachButton, AttachPreview, MessageImages, useAttachments } from "./Attachments";
import { Markdown } from "./Markdown";

export function BranchPanel() {
  const { state, index, selectNode, setBranchMode, sendMessage, mergeStart } = useStore();
  const [text, setText] = useState("");
  const t = useT();
  const lang = useLang();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  const att = useAttachments();
  const canSend = (text.trim().length > 0 || att.images.length > 0) && !merging && !selected.pending;

  const submit = () => {
    if (!canSend) return;
    sendMessage(text, att.images);
    setText("");
    att.clear();
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
        <h2 title={displayBranch(selected.branch, lang)}>{displayBranch(selected.branch, lang)}</h2>
        <button className="icon-btn" aria-label={t.close} onClick={() => selectNode(null)}>
          ×
        </button>
      </div>

      <div className="panel-msgs" ref={listRef}>
        {line.map((m) => {
          const merge = isMergeNode(m);
          return (
            <div key={m.id} className={"msg" + (merge ? " merge" : "") + (m.role === "user" ? " from-user" : " from-ai")}>
              <span className="caption">{merge ? t.merge : m.role === "user" ? t.you : t.assistant}</span>
              <MessageImages images={m.images} />
              {(m.pending || m.text) && <div className="msg-text">{m.pending ? <span className="typing" aria-label={t.typing}><i /><i /><i /></span> : m.role === "assistant" ? <Markdown text={m.text} /> : <span className="plain">{m.text}</span>}</div>}
            </div>
          );
        })}
        <div className="caption panel-hint">
          {t.modelSees(n)}
        </div>
      </div>

      <div className="panel-tools">
        <button
          className={"btn" + (branchOn ? " active" : "")}
          disabled={merging}
          title={forcedBranch ? t.forcedTitle : undefined}
          onClick={() => {
            // у продолжённой точки любое новое сообщение и так станет веткой: просто переводим фокус в поле
            if (forcedBranch) inputRef.current?.focus();
            else setBranchMode(!state.branchMode);
          }}
        >
          <IconBranch size={15} /> {t.branch}
        </button>
        {sis.length > 0 && !consumed && (
          <button className="btn" disabled={merging} onClick={() => mergeStart(selected.id)}>
            <IconMerge size={15} /> {t.combine}
          </button>
        )}
      </div>

      <div className="composer">
        {branchOn && (
          <div className="caption composer-note">
            {forcedBranch ? t.forcedNote : t.newBranchNote}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          disabled={merging}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={att.onPaste}
          placeholder={branchOn ? t.branchPlaceholder : t.continuePlaceholder}
        />
        <AttachPreview images={att.images} onRemove={att.remove} error={att.error} />
        <div className="composer-actions">
          <AttachButton onFiles={(f) => void att.add(f)} disabled={merging} />
          <button className="btn btn-primary" disabled={!canSend} onClick={submit}>
            {branchOn ? t.branch : t.send} <IconSend size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
