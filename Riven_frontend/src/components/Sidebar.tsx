import { useState } from "react";
import { useStore } from "../store";
import { displayTitle, useLang, useT } from "../lib/i18n";
import { SettingsDialog } from "./SettingsDialog";

export function Sidebar() {
  const { state, newTree, selectTree, user, syncStatus } = useStore();
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <aside className="sidebar">
      <div className="brand">Riven</div>
      <button className="btn btn-primary" onClick={newTree}>
        {t.newChatBtn}
      </button>
      <div className="chat-list">
        {state.trees.map((tree) => {
          const n = tree.messages.length;
          return (
            <button
              key={tree.id}
              className={"chat-item" + (tree.id === state.currentTreeId ? " active" : "")}
              onClick={() => selectTree(tree.id)}
            >
              <span className="chat-title">{displayTitle(tree.title, lang)}</span>
              <small>{n === 0 ? t.empty : t.messages(n)}</small>
            </button>
          );
        })}
      </div>
      <button className="settings-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
        <span className="settings-btn-text">
          <span>{t.settings}</span>
          {user && <small title={user.email}>{user.email}</small>}
        </span>
        {user && syncStatus !== "idle" && <span className={"sync-dot sync-" + syncStatus} title={syncStatus === "saving" ? t.saving : t.saveError} />}
      </button>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </aside>
  );
}
