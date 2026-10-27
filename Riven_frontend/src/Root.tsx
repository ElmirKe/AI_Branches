import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { StoreProvider } from "./store";
import App from "./App";
import { AuthScreen } from "./components/AuthScreen";

/**
 * Если Supabase настроен — сначала вход. Без настроек сайт работает локально, как раньше
 * (чаты живут только в памяти страницы).
 */
export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <div className="splash theme-light">Загрузка…</div>;
  if (supabase && !session) return (
      <div className="theme-light">
        <AuthScreen />
      </div>
    );
  return (
    <StoreProvider key={session?.user.id ?? "local"} user={session ? { id: session.user.id, email: session.user.email ?? "" } : null}>
      <App />
    </StoreProvider>
  );
}
