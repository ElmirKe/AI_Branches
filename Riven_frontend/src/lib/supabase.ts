import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/**
 * Клиент Supabase. Если адрес или ключ не заданы, равен null и сайт работает без входа и без
 * сохранения (как раньше). Публичный ключ (anon / publishable) можно держать в коде: доступ к данным
 * защищён правилами RLS из supabase/schema.sql.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
