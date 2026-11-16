import { useEffect, useRef, useState } from "react";
import type { ChatTree } from "../types";
import { useStore } from "../store";
import { displayTitle, useLang, useT } from "../lib/i18n";
import { IconDots, IconEdit, IconGear, IconPlus, IconTrash } from "./Icons";
import { Wordmark } from "./Brand";
import { SettingsDialog } from "./SettingsDialog";

export function Sidebar() {
  const { state, newTree, user, syncStatus } = useStore();
  const t = useT();
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
        {state.trees.map((tree) => (
          <ChatItem key={tree.id} tree={tree} active={tree.id === state.currentTreeId} />
        ))}
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

/** Строка чата в списке: открыть, переименовать, удалить. */
function ChatItem({ tree, active }: { tree: ChatTree; active: boolean }) {
  const { selectTree, renameTree, deleteTree } = useStore();
  const t = useT();
  const lang = useLang();
  const [menu, setMenu] = useState<"closed" | "open" | "confirm">("closed");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const n = tree.messages.length;
  const title = displayTitle(tree.title, lang);

  // меню закрывается кликом мимо него
  useEffect(() => {
    if (menu === "closed") return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu("closed");
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const finishRename = (save: boolean) => {
    if (save && draft.trim() && draft.trim() !== title) renameTree(tree.id, draft);
    setEditing(false);
  };

  return (
    <div ref={rootRef} className={"chat-row" + (active ? " active" : "") + (menu !== "closed" ? " menu-open" : "")}>
      {editing ? (
        <div className="chat-item editing">
          <i className="node" aria-hidden />
          <input
            className="chat-rename"
            autoFocus
            value={draft}
            maxLength={80}
            aria-label={t.chatName}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => finishRename(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishRename(true);
              if (e.key === "Escape") finishRename(false);
            }}
          />
        </div>
      ) : (
        <button className={"chat-item" + (active ? " active" : "")} onClick={() => selectTree(tree.id)}>
          <i className="node" aria-hidden />
          <span className="chat-body">
            <span className="chat-title">{title}</span>
            <small>{n === 0 ? t.empty : t.messages(n)}</small>
          </span>
        </button>
      )}
      {!editing && n > 0 && (
        <button
          className="chat-more"
          aria-label={t.chatActions}
          title={t.chatActions}
          aria-expanded={menu !== "closed"}
          onClick={() => setMenu(menu === "closed" ? "open" : "closed")}
        >
          <IconDots size={16} />
        </button>
      )}
      {menu === "open" && (
        <div className="chat-menu" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setDraft(title);
              setEditing(true);
              setMenu("closed");
            }}
          >
            <IconEdit size={14} /> {t.rename}
          </button>
          <button role="menuitem" className="danger" onClick={() => setMenu("confirm")}>
            <IconTrash size={14} /> {t.delete}
          </button>
        </div>
      )}
      {menu === "confirm" && (
        <div className="chat-menu" role="alertdialog" aria-label={t.deleteAsk}>
          <p>{t.deleteAsk}</p>
          <div className="chat-menu-row">
            <button className="danger solid" onClick={() => deleteTree(tree.id)}>
              {t.delete}
            </button>
            <button onClick={() => setMenu("closed")}>{t.cancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
