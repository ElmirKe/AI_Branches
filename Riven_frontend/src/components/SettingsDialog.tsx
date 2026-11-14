import { useEffect } from "react";
import { useStore } from "../store";
import { LANGS, setLang, useLang, useT } from "../lib/i18n";

interface Option<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          className={value === o.id ? "active" : ""}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Окно настроек: аккаунт, тема, расположение веток, язык. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { state, user, signOut, syncStatus, setTheme, setOrientation } = useStore();
  const t = useT();
  const lang = useLang();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="settings-title">{t.settings}</h2>
          <button className="icon-btn" aria-label={t.close} onClick={onClose}>
            ×
          </button>
        </div>

        <section className="set-row">
          <h3>{t.account}</h3>
          {user ? (
            <div className="set-account">
              <span className="avatar" aria-hidden>
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="set-account-info">
                <small>{t.loggedInAs}</small>
                <span className="account-email" title={user.email}>
                  {user.email}
                </span>
                <span className={"sync sync-" + syncStatus}>
                  {syncStatus === "saving" ? t.saving : syncStatus === "error" ? t.saveError : t.saved}
                </span>
              </span>
              <button className="btn" onClick={signOut}>
                {t.signOut}
              </button>
            </div>
          ) : (
            <p className="set-hint">{t.localMode}</p>
          )}
        </section>

        <section className="set-row">
          <h3>{t.appearance}</h3>
          <Segmented
            label={t.appearance}
            value={state.theme}
            onChange={setTheme}
            options={[
              { id: "light", label: t.light },
              { id: "dark", label: t.dark },
            ]}
          />
        </section>

        <section className="set-row">
          <h3>{t.layout}</h3>
          <Segmented
            label={t.layout}
            value={state.orientation}
            onChange={setOrientation}
            options={[
              { id: "horizontal", label: "↔ " + t.horizontal, hint: t.horizontalHint },
              { id: "vertical", label: "↕ " + t.vertical, hint: t.verticalHint },
            ]}
          />
        </section>

        <section className="set-row">
          <h3>{t.language}</h3>
          <Segmented label={t.language} value={lang} onChange={setLang} options={LANGS} />
          <p className="set-hint">{t.languageHint}</p>
        </section>
      </div>
    </div>
  );
}
