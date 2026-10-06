const DEFAULT_REPLY =
  "Начните с трёх вещей: кто ваш первый пользователь, какую единственную проблему вы решаете, и как вы поймёте, что решение сработало.";

const PLAN_REPLY = [
  "Вот план из четырёх шагов:",
  "1. Определить проблему и аудиторию",
  "2. Собрать минимальную версию продукта",
  "3. Найти первых пользователей",
  "4. Собрать обратную связь и решить, что дальше",
].join("\n");

const PLAN_WORDS = ["план", "шаги", "этапы", "варианты", "разбей"];

/** Заглушка ИИ: один и тот же ответ, кроме просьб о плане/шагах. */
export function generateReply(userText: string): string {
  const t = userText.toLowerCase();
  return PLAN_WORDS.some((w) => t.includes(w)) ? PLAN_REPLY : DEFAULT_REPLY;
}

/** Имитация сетевой задержки 500–1000 мс. */
export function replyDelay(): number {
  return 500 + Math.random() * 500;
}

// ---------- связь с backend ----------

/** Одно сообщение родословной в том виде, в каком его ждёт сервер. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Адрес backend. Задаётся в Riven_frontend/.env.local: VITE_API_URL=http://localhost:8080
 * Если не задан — работает заглушка выше (удобно для демо без сервера).
 */
const API_URL = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 60_000;

export const usesRealBackend = API_URL !== "";

export class ReplyError extends Error {}

/**
 * Получить ответ ИИ на последнее сообщение.
 * `context` — ТОЛЬКО родословная ветки (от корня до вопроса), последнее сообщение — от пользователя.
 * Бросает ReplyError с текстом, который можно показать пользователю.
 */
export async function fetchReply(context: ChatTurn[]): Promise<string> {
  if (!usesRealBackend) {
    await new Promise((resolve) => window.setTimeout(resolve, replyDelay()));
    return generateReply(context[context.length - 1]?.content ?? "");
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: context }),
        signal: ctrl.signal,
      });
    } catch {
      throw new ReplyError(
        ctrl.signal.aborted
          ? "Сервер не ответил за 60 секунд."
          : `Не удалось связаться с сервером (${API_URL}). Он запущен? Адрес сайта указан в ALLOWED_ORIGINS?`,
      );
    }

    let data: { answer?: unknown; error?: unknown } | null = null;
    try {
      data = await res.json();
    } catch {
      /* тело не JSON — обработаем ниже */
    }
    if (!res.ok) {
      throw new ReplyError(typeof data?.error === "string" ? data.error : `Сервер ответил ошибкой ${res.status}.`);
    }
    if (typeof data?.answer !== "string" || data.answer.trim() === "") {
      throw new ReplyError("Сервер вернул пустой ответ.");
    }
    return data.answer;
  } finally {
    window.clearTimeout(timer);
  }
}

const ITEM_RE =/^\s*(\d+[.)]|[-–—•*]\s)/;
const STRIP_RE = /^\s*(\d+[.)]\s*|[-–—•*]\s+)/;

/**
 * Возвращает пункты списка, если в тексте есть 2+ строки-пункта подряд
 * (пустые строки между ними допустимы). Иначе — пустой массив.
 */
export function detectList(text: string): string[] {
  let best: string[] = [];
  let run: string[] = [];
  for (const line of text.split("\n")) {
    if (ITEM_RE.test(line)) {
      run.push(line.replace(STRIP_RE, "").trim());
    } else if (line.trim() !== "") {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  if (run.length > best.length) best = run;
  return best.length >= 2 ? best : [];
}
