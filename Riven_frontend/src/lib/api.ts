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
export async function fetchReply(context: ChatTurn[], onChunk: (chunk: string) => void = () => {}): Promise<string> {
  if (!usesRealBackend) {
    await new Promise((resolve) => window.setTimeout(resolve, replyDelay()));
    const answer = generateReply(context[context.length - 1]?.content ?? "");
    onChunk(answer);
    return answer;
  }

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/chat/stream`, {
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

    if (!res.ok) {
      let message = `Сервер ответил ошибкой ${res.status}.`;
      try {
        const data: { error?: unknown } = await res.json();
        if (typeof data.error === "string") message = data.error;
      } catch {
        /* тело не JSON */
      }
      throw new ReplyError(message);
    }
    if (!res.body) {
      throw new ReplyError("Сервер не открыл поток ответа.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";

    const processEvent = (event: string) => {
      const dataLine = event.split(/\r?\n/).find((line) => line.startsWith("data:"));
      if (!dataLine) return;
      let data: { text?: unknown; error?: unknown };
      try {
        data = JSON.parse(dataLine.slice(5).trimStart()) as { text?: unknown; error?: unknown };
      } catch {
        throw new ReplyError("Сервер прислал повреждённый фрагмент ответа.");
      }
      if (typeof data.error === "string") throw new ReplyError(data.error);
      if (typeof data.text === "string" && data.text !== "") {
        answer += data.text;
        onChunk(data.text);
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let separator: number;
      while ((separator = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const event = buffer.slice(0, separator);
        const match = buffer.slice(separator).match(/^\r?\n\r?\n/);
        buffer = buffer.slice(separator + (match?.[0].length ?? 2));
        processEvent(event);
      }
      if (done) break;
    }
    if (buffer.trim()) processEvent(buffer);
    if (answer.trim() === "") {
      throw new ReplyError("Сервер вернул пустой ответ.");
    }
    return answer;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Короткое название по смыслу (чат — до 4 слов, семья — до 3).
 * Возвращает null, если сервера нет или он не ответил — тогда остаётся локальная выжимка.
 */
export async function fetchTitle(kind: "chat" | "family", texts: string[]): Promise<string | null> {
  if (!usesRealBackend || texts.length === 0) return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch(`${API_URL}/api/title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, texts }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data: { title?: unknown } = await res.json();
    return typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 60) : null;
  } catch {
    return null;
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
