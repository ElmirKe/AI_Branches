import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { LANGS, setLang, tr, useLang, useT } from "../lib/i18n";
import { BrandRule, Tagline, Wordmark } from "./Brand";

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

  const google = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    // уходим на страницу Google; после входа Supabase вернёт на этот же сайт уже с сессией
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(explain(err.message));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="seg seg-sm auth-lang" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button key={l.id} type="button" className={lang === l.id ? "active" : ""} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>
            {l.id.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="auth-lockup">
        <Wordmark height={96} />
        <Tagline />
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">{mode === "in" ? t.welcomeBack : t.createAccount}</h1>
        <p className="auth-sub">{mode === "in" ? t.signInSub : t.signUpSub}</p>
        <button type="button" className="btn google-btn" onClick={google} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {t.google}
        </button>
        <div className="auth-or">
          <span>{t.or}</span>
        </div>
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
      <BrandRule />
    </div>
  );
}
