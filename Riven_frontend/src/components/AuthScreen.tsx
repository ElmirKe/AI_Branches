import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

/** Понятные сообщения вместо английских ошибок Supabase. */
function explain(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Неверная почта или пароль.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Эта почта уже зарегистрирована. Войдите.";
  if (m.includes("at least") && m.includes("character")) return "Пароль слишком короткий: нужно минимум 6 символов.";
  if (m.includes("email not confirmed")) return "Почта не подтверждена: откройте письмо от Supabase и перейдите по ссылке.";
  if (m.includes("rate limit") || m.includes("too many")) return "Слишком много попыток. Подождите минуту и повторите.";
  if (m.includes("valid email") || m.includes("invalid email")) return "Проверьте адрес почты.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Нет связи с сервером. Проверьте интернет.";
  return message;
}

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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
        else if (!data.session) setInfo("Мы отправили письмо со ссылкой. Подтвердите почту и затем войдите.");
      }
    } catch (ex) {
      setError(explain(ex instanceof Error ? ex.message : "Не удалось выполнить вход."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">Riven</div>
        <p className="auth-sub">Чаты-деревья с ветками. Войдите, чтобы ваши чаты сохранялись.</p>
        <label>
          Почта
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Пароль
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
          {busy ? "Подождите…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
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
          {mode === "in" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </form>
    </div>
  );
}
