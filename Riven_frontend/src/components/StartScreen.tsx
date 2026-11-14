import { useState, type KeyboardEvent } from "react";
import { useStore } from "../store";
import { useT } from "../lib/i18n";

export function StartScreen() {
  const { sendMessage } = useStore();
  const [text, setText] = useState("");
  const t = useT();
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
        <h1>{t.startTitle}</h1>
        <p>{t.startText}</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.startPlaceholder}
        />
        <div className="start-actions">
          <button className="btn btn-primary" disabled={!canSend} onClick={submit}>
            {t.start}
          </button>
        </div>
      </div>
    </div>
  );
}
