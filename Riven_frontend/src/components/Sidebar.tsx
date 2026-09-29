import { useStore } from "../store";
import { plural } from "../lib/layout";

export function Sidebar() {
  const { state, newTree, selectTree, setTheme } = useStore();
  return (
    <aside className="sidebar">
      <div className="brand">Форки</div>
      <button className="btn btn-primary" onClick={newTree}>
        + Новый чат
      </button>
      <div className="chat-list">
        {state.trees.map((t) => {
          const n = t.messages.length;
          return (
            <button
              key={t.id}
              className={"chat-item" + (t.id === state.currentTreeId ? " active" : "")}
              onClick={() => selectTree(t.id)}
            >
              <span className="chat-title">{t.title}</span>
              <small>{n === 0 ? "пусто" : `${n} ${plural(n, "сообщение", "сообщения", "сообщений")}`}</small>
            </button>
          );
        })}
      </div>
      <div className="theme-switch" role="group" aria-label="Тема">
        <button className={state.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
          Светлая
        </button>
        <button className={state.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
          Тёмная
        </button>
      </div>
    </aside>
  );
}
