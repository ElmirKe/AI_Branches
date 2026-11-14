import { useState } from "react";
import { useStore } from "../store";
import { displayTitle, useLang, useT } from "../lib/i18n";
import { IconGear, IconPlus } from "./Icons";
import { Wordmark } from "./Brand";
import { SettingsDialog } from "./SettingsDialog";

export function Sidebar() {
  const { state, newTree, selectTree, user, syncStatus } = useStore();
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  return (
    <aside className="sidebar">
      <div className="brand">
        <Wordmark height={34} />
      </div>
      <button className="btn btn-primary" onClick={newTree}>
        <IconPlus size={16} /> {t.newChat}
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
              <i className="node" aria-hidden />
              <span className="chat-body">
                <span className="chat-title">{displayTitle(tree.title, lang)}</span>
                <small>{n === 0 ? t.empty : t.messages(n)}</small>
              </span>
            </button>
          );
        })}
      </div>
      <button className="settings-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconGear size={17} />
        <span className="settings-btn-text">
          <span>{t.settings}</span>
          {user && <small title={user.email}>{user.email}</small>}
        </span>
        {user && syncStatus !== "idle" && (
          <span className={"sync-dot sync-" + syncStatus} title={syncStatus === "saving" ? t.saving : t.saveError} />
        )}
      </button>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </aside>
  );
}
