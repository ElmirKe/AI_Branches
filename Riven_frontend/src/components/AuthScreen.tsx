import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { LANGS, setLang, tr, useLang, useT } from "../lib/i18n";

/** Понятные сообщения вместо английских ошибок Supabase. */
function explain(message: string): string {
  const t = tr();
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return t.errBadLogin;
  if (m.includes("already registered") || m.includes("already been registered")) return t.errExists;
  if (m.includes("at least") && m.includes("character")) return t.errShort;
  if (m.includes("email not confirmed")) return t.errNotConfirmed;
  if (m.includes("rate limit") || m.includes("too many")) return t.errRate;
  if (m.includes("valid email") || m.includes("invalid email")) return t.errEmail;
  if (m.includes("failed to fetch") || m.includes("network")) return t.errNetwork;
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const t = useT();
  const lang = useLang();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) setError(explain(err.message));
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) setError(explain(err.message));
        else if (!data.session) setInfo(tr().checkMail);
      }
    } catch (ex) {
      setError(explain(ex instanceof Error ? ex.message : tr().errSignIn));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-top">
          <div className="brand">Riven</div>
          <div className="seg seg-sm" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={lang === l.id ? "active" : ""}
                aria-pressed={lang === l.id}
                onClick={() => setLang(l.id)}
              >
                {l.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p className="auth-sub">{t.authSub}</p>
        <label>
          {t.email}
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t.password}
          <input
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="auth-msg auth-error">{error}</div>}
        {info && <div className="auth-msg">{info}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? t.wait : mode === "in" ? t.signIn : t.signUp}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError("");
            setInfo("");
          }}
        >
          {mode === "in" ? t.toSignUp : t.toSignIn}
        </button>
      </form>
    </div>
  );
}
