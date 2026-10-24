import { useState } from "react";
import { getGeminiApiKey, saveGeminiApiKey } from "../lib/api";

export function ApiKeySettings() {
  const [savedKey, setSavedKey] = useState(getGeminiApiKey);
  const [draft, setDraft] = useState(savedKey);
  const saved = savedKey !== "" && draft === savedKey;

  const save = () => {
    saveGeminiApiKey(draft);
    setSavedKey(draft.trim());
  };

  const clear = () => {
    saveGeminiApiKey("");
    setDraft("");
    setSavedKey("");
  };

  return (
    <div className="api-key-settings">
      <label htmlFor="gemini-key">Gemini API key</label>
      <input
        id="gemini-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        placeholder="Вставьте ключ"
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="api-key-actions">
        <button className="btn" disabled={!draft.trim() || saved} onClick={save}>
          {saved ? "Сохранён" : "Сохранить"}
        </button>
        {savedKey && (
          <button className="btn" onClick={clear}>
            Удалить
          </button>
        )}
      </div>
      <small>Хранится только в этой вкладке и отправляется напрямую в Google.</small>
    </div>
  );
}
