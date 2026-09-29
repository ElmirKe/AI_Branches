import { useState, type KeyboardEvent } from "react";
import { useStore } from "../store";

export function StartScreen() {
  const { sendMessage } = useStore();
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

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
    <div className="start">
      <div className="start-box">
        <h1>Начните разговор</h1>
        <p>
          Любой ответ можно продолжить или ответвить — так вы исследуете несколько направлений одного
          вопроса, не теряя нить.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Например: как спланировать запуск нового продукта?"
        />
        <div className="start-actions">
          <button className="btn btn-primary" disabled={!canSend} onClick={submit}>
            Начать
          </button>
        </div>
      </div>
    </div>
  );
}
