import type { ChatTree, Message } from "../types";
import { supabase } from "./supabase";

const PAGE = 1000; // PostgREST по умолчанию отдаёт не больше 1000 строк за запрос

interface ChatRow {
  id: string;
  title: string;
  family_titles: Record<string, string> | null;
  created_at: string;
}
interface MessageRow {
  chat_id: string;
  id: string;
  parents: string[] | null;
  role: "user" | "assistant";
  branch: string;
  text: string;
}

function client() {
  if (!supabase) throw new Error("Supabase не настроен");
  return supabase;
}

/** Все чаты пользователя (новые сверху) вместе с сообщениями. */
export async function loadTrees(): Promise<ChatTree[]> {
  const db = client();
  const { data: chats, error } = await db
    .from("chats")
    .select("id,title,family_titles,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (chats ?? []) as ChatRow[];
  if (rows.length === 0) return [];

  const byChat = new Map<string, Message[]>();
  for (let from = 0; ; from += PAGE) {
    const { data, error: e2 } = await db
      .from("messages")
      .select("chat_id,id,parents,role,branch,text")
      .order("seq", { ascending: true })
      .range(from, from + PAGE - 1);
    if (e2) throw new Error(e2.message);
    const page = (data ?? []) as MessageRow[];
    for (const r of page) {
      const list = byChat.get(r.chat_id) ?? [];
      list.push({ id: r.id, parents: r.parents ?? [], role: r.role, branch: r.branch, text: r.text });
      byChat.set(r.chat_id, list);
    }
    if (page.length < PAGE) break;
  }

  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: Date.parse(c.created_at) || Date.now(),
    messages: byChat.get(c.id) ?? [],
    familyTitles: c.family_titles ?? {},
  }));
}

/** Создаёт или обновляет строку чата (название, названия семей). */
export async function saveChat(tree: ChatTree): Promise<void> {
  const { error } = await client()
    .from("chats")
    .upsert(
      {
        id: tree.id,
        title: tree.title,
        family_titles: tree.familyTitles ?? {},
        created_at: new Date(tree.createdAt).toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(error.message);
}

/** Создаёт или обновляет сообщения чата. Порядок вставки сохраняется (колонка seq). */
export async function saveMessages(chatId: string, messages: Message[]): Promise<void> {
  if (messages.length === 0) return;
  const { error } = await client()
    .from("messages")
    .upsert(
      messages.map((m) => ({
        chat_id: chatId,
        id: m.id,
        parents: m.parents,
        role: m.role,
        branch: m.branch,
        text: m.text,
      })),
      { onConflict: "chat_id,id" },
    );
  if (error) throw new Error(error.message);
}
