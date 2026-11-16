import { useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "../store";
import { useT } from "../lib/i18n";
import { IconSend } from "./Icons";
import { Tagline, Wordmark } from "./Brand";
import { AttachButton, AttachPreview, useAttachments } from "./Attachments";

export function StartScreen() {
  const { sendMessage } = useStore();
  const t = useT();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const att = useAttachments();
  const canSend = text.trim().length > 0 || att.images.length > 0;

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
    <div className="start">
      <div className="start-box">
        <div className="start-mark">
          <Wordmark height={104} />
        </div>
        <Tagline />
        <p>{t.startText}</p>
        <div className="start-input">
          <textarea
            ref={ref}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={att.onPaste}
            placeholder={t.startPlaceholder}
          />
          <AttachPreview images={att.images} onRemove={att.remove} error={att.error} />
          <div className="start-attach">
            <AttachButton onFiles={(f) => void att.add(f)} />
          </div>
          <button className="send-fab" disabled={!canSend} onClick={submit} aria-label={t.start} title={t.start}>
            <IconSend size={18} />
          </button>
        </div>
        <div className="ideas" aria-label={t.examples}>
          <span className="ideas-cap">{t.ideasCap}</span>
          {t.ideas.map((idea) => (
            <button
              key={idea}
              className="idea"
              onClick={() => {
                setText(idea);
                ref.current?.focus();
              }}
            >
              {idea}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
