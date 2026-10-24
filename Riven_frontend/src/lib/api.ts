// ---------- прямое подключение к Gemini из браузера ----------

/** Одно сообщение родословной в формате приложения. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
const KEY_STORAGE = "riven.gemini-api-key";
const REQUEST_TIMEOUT_MS = 60_000;

export class ReplyError extends Error {}

export function getGeminiApiKey(): string {
  try {
    return window.sessionStorage.getItem(KEY_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveGeminiApiKey(value: string): void {
  const key = value.trim();
  try {
    if (key) window.sessionStorage.setItem(KEY_STORAGE, key);
    else window.sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    throw new ReplyError("Браузер не разрешил сохранить ключ в этой вкладке.");
  }
}

interface GeminiChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
  }>;
  error?: { message?: unknown };
}

function chunkText(chunk: GeminiChunk): string {
  return (chunk.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function friendlyGeminiError(status: number): string {
  if (status === 400 || status === 401 || status === 403) {
    return "Gemini не принял API-ключ. Проверьте его в настройках слева.";
  }
  if (status === 429) return "Лимит Gemini исчерпан. Подождите и попробуйте снова.";
  return `Gemini ответил ошибкой ${status}.`;
}

/**
 * Получить streaming-ответ напрямую от Gemini. Ключ берётся из sessionStorage и
 * отправляется только Google; GitHub Pages его не получает и не хранит.
 */
export async function fetchReply(context: ChatTurn[], onChunk: (chunk: string) => void = () => {}): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new ReplyError("Добавьте API-ключ Gemini в настройках слева.");

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: context.map((turn) => ({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.content }],
          })),
          generationConfig: {
            thinkingConfig: { thinkingLevel: "minimal" },
          },
        }),
        signal: ctrl.signal,
      });
    } catch {
      throw new ReplyError(ctrl.signal.aborted ? "Gemini не ответил за 60 секунд." : "Не удалось связаться с Gemini.");
    }

    if (!res.ok) throw new ReplyError(friendlyGeminiError(res.status));
    if (!res.body) throw new ReplyError("Gemini не открыл поток ответа.");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";

    const processEvent = (event: string) => {
      const dataLine = event.split(/\r?\n/).find((line) => line.startsWith("data:"));
      if (!dataLine) return;
      let data: GeminiChunk;
      try {
        data = JSON.parse(dataLine.slice(5).trimStart()) as GeminiChunk;
      } catch {
        throw new ReplyError("Gemini прислал повреждённый фрагмент ответа.");
      }
      if (data.error) {
        throw new ReplyError(typeof data.error.message === "string" ? data.error.message : "Ошибка Gemini.");
      }
      const text = chunkText(data);
      if (text) {
        answer += text;
        onChunk(text);
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
    if (!answer.trim()) throw new ReplyError("Gemini вернул пустой ответ.");
    return answer;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Названия остаются локальными: отдельный AI-запрос больше не нужен. */
export async function fetchTitle(_kind: "chat" | "family", _texts: string[]): Promise<string | null> {
  return null;
}

const ITEM_RE =/^\s*(\d+[.)]|[-–—•*]\s)/;
const STRIP_RE = /^\s*(\d+[.)]\s*|[-–—•*]\s+)/;

/** Возвращает пункты списка, если в тексте есть 2+ строки-пункта подряд. */
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
